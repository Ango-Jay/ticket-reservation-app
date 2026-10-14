import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsUUID,
  Min,
} from 'class-validator';
import { normalizeEmail } from '../../../utils/normalize-email';

export class CreateReservationDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeEmail(value) : value,
  )
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsUUID()
  ticketTypeId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}
