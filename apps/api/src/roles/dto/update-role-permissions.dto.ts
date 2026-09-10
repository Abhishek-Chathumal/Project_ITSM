import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SCOPES, type ScopeValue } from '@itsm/shared';

/**
 * One permission granted to a role, with the scope it reaches.
 *
 * Scope is per permission, not per role (Amendment A-001, Ref I3.1) — a role may hold
 * `request.view` at `department` and `request.edit` at `own` — so the wire format has to
 * carry a scope alongside every key rather than one scope for the whole request.
 */
export class RolePermissionGrantDto {
  @ApiProperty({ description: 'Permission key from the catalogue, e.g. request.view' })
  @IsString()
  key!: string;

  @ApiProperty({
    enum: SCOPES,
    description:
      'Which records this permission reaches. Required — there is no default, because ' +
      'whichever one were chosen would be wrong half the time.',
  })
  @IsEnum(SCOPES)
  scope!: ScopeValue;

  @ApiProperty({
    required: false,
    description:
      'Subtree depth for hierarchy/department/location scopes. 1 = immediate children only; ' +
      'omit for the whole subtree. Ignored for other scopes.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  scopeDepth?: number;

  @ApiProperty({ required: false, description: 'Required when scope is "custom".' })
  @IsOptional()
  @IsString()
  customScopeId?: string;
}

export class UpdateRolePermissionsDto {
  @ApiProperty({
    type: [RolePermissionGrantDto],
    description: 'Full replacement set of permission grants for this role',
  })
  @IsArray()
  // The catalogue is ~174 entries; a request an order of magnitude larger than that is not a
  // legitimate role definition.
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => RolePermissionGrantDto)
  permissions!: RolePermissionGrantDto[];
}
