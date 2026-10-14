import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Env, EnvironmentVariables } from '../../config/env';
import { parseDurationToMs } from '../../utils/parse-duration';
import { randomAlphanumeric } from '../../utils/slugify';
import { EventStatus } from '../events/enums';
import { Event } from '../events/event.entity';
import { TicketType } from '../events/ticket-type.entity';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ReservationStatus } from './enums';
import { Reservation } from './reservation.entity';

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(Reservation)
    private readonly reservationsRepository: Repository<Reservation>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  async create(
    eventId: string,
    dto: CreateReservationDto,
  ): Promise<Reservation> {
    return this.dataSource.transaction(async (manager) => {
      const event = await manager.findOne(Event, {
        where: { id: eventId, status: EventStatus.Active },
      });
      if (!event) {
        throw new NotFoundException('Event not found');
      }

      const ticketType = await manager.findOne(TicketType, {
        where: { id: dto.ticketTypeId, eventId: event.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!ticketType) {
        throw new NotFoundException('Ticket type not found for this event');
      }

      const reserved = await this.getSumOfReservedForTicketType(
        manager,
        ticketType.id,
      );
      const available = ticketType.quantity - reserved;
      if (dto.quantity > available) {
        throw new ConflictException('Not enough tickets available');
      }

      const reservationNumber = await this.allocateReservationNumber(
        manager,
        event.slug,
      );
      const holdMs = parseDurationToMs(
        this.config.getOrThrow(Env.RESERVATION_HOLD_EXPIRES_IN, {
          infer: true,
        }),
      );

      const reservation = manager.create(Reservation, {
        eventId: event.id,
        ticketTypeId: ticketType.id,
        reservationNumber,
        email: dto.email,
        quantity: dto.quantity,
        status: ReservationStatus.Held,
        expiresAt: new Date(Date.now() + holdMs),
      });

      return manager.save(reservation);
    });
  }

  async findByNumber(reservationNumber: string): Promise<Reservation> {
    const reservation = await this.requireByNumber(reservationNumber);
    return this.lazyExpire(reservation);
  }

  async confirm(reservationNumber: string): Promise<Reservation> {
    let reservation = await this.requireByNumber(reservationNumber);
    reservation = await this.lazyExpire(reservation);

    if (reservation.status !== ReservationStatus.Held) {
      throw new ConflictException('Reservation cannot be confirmed');
    }
    if (reservation.expiresAt.getTime() <= Date.now()) {
      reservation.status = ReservationStatus.Expired;
      await this.reservationsRepository.save(reservation);
      throw new ConflictException('Reservation hold has expired');
    }

    reservation.status = ReservationStatus.Confirmed;
    return this.reservationsRepository.save(reservation);
  }

  async cancel(reservationNumber: string): Promise<Reservation> {
    let reservation = await this.requireByNumber(reservationNumber);
    reservation = await this.lazyExpire(reservation);

    if (reservation.status !== ReservationStatus.Held) {
      throw new ConflictException('Reservation cannot be cancelled');
    }

    reservation.status = ReservationStatus.Cancelled;
    return this.reservationsRepository.save(reservation);
  }

  private async requireByNumber(
    reservationNumber: string,
  ): Promise<Reservation> {
    const reservation = await this.reservationsRepository.findOne({
      where: { reservationNumber },
      relations: { event: true, ticketType: true },
    });
    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }
    return reservation;
  }

  private async lazyExpire(reservation: Reservation): Promise<Reservation> {
    if (
      reservation.status === ReservationStatus.Held &&
      reservation.expiresAt.getTime() <= Date.now()
    ) {
      reservation.status = ReservationStatus.Expired;
      return this.reservationsRepository.save(reservation);
    }
    return reservation;
  }

  private async allocateReservationNumber(
    manager: EntityManager,
    eventSlug: string,
  ): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const reservationNumber = `${eventSlug}-${randomAlphanumeric(8)}`;
      const existing = await manager.findOne(Reservation, {
        where: { reservationNumber },
      });
      if (!existing) {
        return reservationNumber;
      }
    }
    throw new BadRequestException('Unable to allocate reservation number');
  }

  private async getSumOfReservedForTicketType(
    manager: EntityManager,
    ticketTypeId: string,
  ): Promise<number> {
    const row = await manager
      .createQueryBuilder(Reservation, 'reservation')
      .select('COALESCE(SUM(reservation.quantity), 0)', 'reserved')
      .where('reservation.ticket_type_id = :ticketTypeId', { ticketTypeId })
      .andWhere(
        `(
          reservation.status = :confirmed
          OR (reservation.status = :held AND reservation.expires_at > :now)
        )`,
        {
          confirmed: ReservationStatus.Confirmed,
          held: ReservationStatus.Held,
          now: new Date(),
        },
      )
      .getRawOne<{ reserved: string }>();

    return Number(row?.reserved ?? 0);
  }
}
