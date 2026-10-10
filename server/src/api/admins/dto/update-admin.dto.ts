import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AdminStatus } from '../enums';

export class UpdateAdminDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  lastName?: string;

  @IsOptional()
  @IsEnum(AdminStatus)
  status?: AdminStatus;
}
