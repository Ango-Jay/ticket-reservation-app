import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import Decimal from 'decimal.js';
import { NotificationService } from '../../common/notification/notification.service';
import { Env, EnvironmentVariables } from '../../config/env';
import { parseDurationToMs } from '../../utils/parse-duration';
import { randomAlphanumeric } from '../../utils/slugify';
import { EventStatus } from '../events/enums';
import { Event } from '../events/event.entity';
import { TicketType } from '../events/ticket-type.entity';
import type { CreateCheckoutResult } from '../integrations/ports/payment.port';
import { PaymentsService } from '../payments/payments.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ReservationStatus } from './enums';
import { Reservation } from './reservation.entity';

@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);

  constructor(
    @InjectRepository(Reservation)
    private readonly reservationsRepository: Repository<Reservation>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly notificationService: NotificationService,
    private readonly paymentsService: PaymentsService,
  ) {}

  async create(
    eventId: string,
    dto: CreateReservationDto,
  ): Promise<Reservation> {
    const { reservation, eventTitle, ticketTypeName } =
      await this.dataSource.transaction(async (manager) => {
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

        const created = manager.create(Reservation, {
          eventId: event.id,
          ticketTypeId: ticketType.id,
          reservationNumber,
          email: dto.email,
          quantity: dto.quantity,
          status: ReservationStatus.Held,
          expiresAt: new Date(Date.now() + holdMs),
        });

        const saved = await manager.save(created);
        return {
          reservation: saved,
          eventTitle: event.title,
          ticketTypeName: ticketType.name,
        };
      });

    this.notificationService
      .sendEmail({
        to: reservation.email,
        subject: `Reservation held: ${reservation.reservationNumber}`,
        template: 'reservation-held',
        context: {
          email: reservation.email,
          reservationNumber: reservation.reservationNumber,
          quantity: reservation.quantity,
          eventTitle,
          ticketTypeName,
          expiresAt: reservation.expiresAt.toISOString(),
        },
      })
      .catch((err: unknown) => {
        this.logger.error(
          `Held reservation email failed for ${reservation.email}`,
          err instanceof Error ? err.stack : err,
        );
      });

    return reservation;
  }

  async findByNumber(reservationNumber: string): Promise<Reservation> {
    const reservation = await this.requireByNumber(reservationNumber);
    return this.lazyExpire(reservation);
  }

  async checkout(
    reservationNumber: string,
  ): Promise<Reservation | CreateCheckoutResult> {
    const reservation = await this.requireOpenHold(reservationNumber);
    const amount = this.amountFor(reservation);
    if (amount.isZero()) {
      return this.confirmHeld(reservation);
    }

    return this.paymentsService.startCheckout({
      reservationId: reservation.id,
      amount,
      currency: reservation.ticketType.currency,
      email: reservation.email,
      reservationNumber: reservation.reservationNumber,
      expiresInMinutes: this.minutesUntil(reservation.expiresAt),
    });
  }

  async confirm(reservationNumber: string): Promise<Reservation> {
    const reservation = await this.requireOpenHold(reservationNumber);
    if (this.amountFor(reservation).gt(0)) {
      throw new ConflictException(
        'Paid reservations are confirmed by the payment webhook',
      );
    }
    return this.confirmHeld(reservation);
  }

  async confirmPaidFromWebhook(reservationId: string): Promise<boolean> {
    const reservation = await this.reservationsRepository.findOne({
      where: { id: reservationId },
      relations: { event: true, ticketType: true },
    });
    if (!reservation || reservation.status !== ReservationStatus.Held) {
      return false;
    }
    if (reservation.expiresAt.getTime() <= Date.now()) {
      reservation.status = ReservationStatus.Expired;
      await this.reservationsRepository.save(reservation);
      return false;
    }
    await this.confirmHeld(reservation);
    return true;
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

  private async requireOpenHold(
    reservationNumber: string,
  ): Promise<Reservation> {
    let reservation = await this.requireByNumber(reservationNumber);
    reservation = await this.lazyExpire(reservation);
    if (reservation.status !== ReservationStatus.Held) {
      throw new ConflictException('Reservation is not held');
    }
    if (reservation.expiresAt.getTime() <= Date.now()) {
      reservation.status = ReservationStatus.Expired;
      await this.reservationsRepository.save(reservation);
      throw new ConflictException('Reservation hold has expired');
    }
    return reservation;
  }

  private async confirmHeld(reservation: Reservation): Promise<Reservation> {
    reservation.status = ReservationStatus.Confirmed;
    const saved = await this.reservationsRepository.save(reservation);
    this.sendConfirmedEmail(saved);
    return saved;
  }

  private amountFor(reservation: Reservation): Decimal {
    if (!reservation.ticketType) {
      throw new NotFoundException('Ticket type not found');
    }
    return new Decimal(reservation.ticketType.price).mul(reservation.quantity);
  }

  private minutesUntil(expiresAt: Date): number {
    const minutes = Math.ceil((expiresAt.getTime() - Date.now()) / 60_000);
    return Math.min(1440, Math.max(1, minutes));
  }

  private sendConfirmedEmail(saved: Reservation): void {
    this.notificationService
      .sendEmail({
        to: saved.email,
        subject: `Reservation confirmed: ${saved.reservationNumber}`,
        template: 'reservation-confirmed',
        context: {
          email: saved.email,
          reservationNumber: saved.reservationNumber,
          quantity: saved.quantity,
          eventTitle: saved.event?.title ?? '',
          ticketTypeName: saved.ticketType?.name ?? '',
        },
      })
      .catch((err: unknown) => {
        this.logger.error(
          `Confirmed reservation email failed for ${saved.email}`,
          err instanceof Error ? err.stack : err,
        );
      });
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
