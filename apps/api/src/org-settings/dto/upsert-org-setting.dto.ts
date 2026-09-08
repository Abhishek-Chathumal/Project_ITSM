import { ApiProperty } from '@nestjs/swagger';
import { IsDefined } from 'class-validator';

export class UpsertOrgSettingDto {
  @ApiProperty()
  @IsDefined()
  value!: unknown;
}
