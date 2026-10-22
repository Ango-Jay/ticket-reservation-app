import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from '../events/event.entity';
import { TicketType } from '../events/ticket-type.entity';
import { PaymentsModule } from '../payments/payments.module';
import { ExpireHeldReservationsJob } from './expire-held-reservations.job';
import { Reservation } from './reservation.entity';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Reservation, Event, TicketType]),
    PaymentsModule,
  ],
  controllers: [ReservationsController],
  providers: [ReservationsService, ExpireHeldReservationsJob],
  exports: [TypeOrmModule, ReservationsService],
})
export class ReservationsModule {}
