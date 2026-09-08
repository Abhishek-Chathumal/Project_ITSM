import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import type { AppConfig } from './config/configuration';
import { buildSessionMiddleware } from './auth/session.middleware';
import { buildCsrfMiddleware } from './auth/csrf.middleware';
import { setCsrfTokenGenerator } from './auth/csrf.util';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService);
  const appConfig = config.get<AppConfig>('app')!;

  app.use(cookieParser());
  app.use(await buildSessionMiddleware(appConfig));

  const { doubleCsrfProtection, generateToken } = buildCsrfMiddleware(appConfig);
  setCsrfTokenGenerator(generateToken);
  app.use(doubleCsrfProtection);

  app.enableCors({ origin: appConfig.corsOrigin, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('IT Support Portal API')
    .setDescription('ITSM Portal REST API — Phase 0 foundation')
    .setVersion('0.1.0')
    .addCookieAuth('connect.sid')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(appConfig.port);
}

bootstrap();
