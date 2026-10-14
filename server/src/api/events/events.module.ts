import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminsModule } from '../admins/admins.module';
import { Reservation } from '../reservations/reservation.entity';
import { AdminEventsController } from './admin-events.controller';
import { Event } from './event.entity';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { TicketType } from './ticket-type.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Event, TicketType, Reservation]),
    AdminsModule,
  ],
  controllers: [EventsController, AdminEventsController],
  providers: [EventsService],
  exports: [TypeOrmModule, EventsService],
})
export class EventsModule {}
