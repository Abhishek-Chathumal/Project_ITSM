import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/guards/session-auth.guard';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { AuditService } from '../audit/audit.service';
import { generateCsrfToken } from './csrf.util';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly auditService: AuditService,
  ) {}

  @Public()
  @Get('csrf')
  async getCsrfToken(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // Force the session to persist now so the CSRF token stays bound to a stable
    // session id across the subsequent login request (express-session only sends
    // Set-Cookie once something has actually been saved to the store).
    req.session.csrfIssued = true;
    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => (err ? reject(err) : resolve()));
    });
    const token = generateCsrfToken(req, res);
    return { csrfToken: token };
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const user = await this.authService.validateCredentials(dto.email, dto.password);

    await new Promise<void>((resolve, reject) => {
      req.session.regenerate((err) => (err ? reject(err) : resolve()));
    });
    req.session.userId = user.id;

    await this.auditService.record({
      actorId: user.id,
      action: 'auth.login',
      entityType: 'User',
      entityId: user.id,
      ipAddress: req.ip,
    });

    return this.authService.toSessionUserDto(user);
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    await this.auditService.record({
      actorId: user.id,
      action: 'auth.logout',
      entityType: 'User',
      entityId: user.id,
      ipAddress: req.ip,
    });

    await new Promise<void>((resolve, reject) => {
      req.session.destroy((err) => (err ? reject(err) : resolve()));
    });

    return { success: true };
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getSessionUserDto(user.id);
  }
}
