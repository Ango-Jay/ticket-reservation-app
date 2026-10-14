import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { Reservation } from './reservation.entity';
import { ReservationsService } from './reservations.service';

@ApiTags('reservations')
@Controller()
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Post('events/:eventId/reservations')
  create(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: CreateReservationDto,
  ): Promise<Reservation> {
    return this.reservationsService.create(eventId, dto);
  }

  @Get('reservations/:reservationNumber')
  findOne(
    @Param('reservationNumber') reservationNumber: string,
  ): Promise<Reservation> {
    return this.reservationsService.findByNumber(reservationNumber);
  }

  @Post('reservations/:reservationNumber/confirm')
  confirm(
    @Param('reservationNumber') reservationNumber: string,
  ): Promise<Reservation> {
    return this.reservationsService.confirm(reservationNumber);
  }

  @Post('reservations/:reservationNumber/cancel')
  cancel(
    @Param('reservationNumber') reservationNumber: string,
  ): Promise<Reservation> {
    return this.reservationsService.cancel(reservationNumber);
  }
}
