import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Decimal from 'decimal.js';
import { DataSource, EntityManager, In, Not, Repository } from 'typeorm';
import { ReservationStatus } from '../reservations/enums';
import { Reservation } from '../reservations/reservation.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { TicketTypeDto } from './dto/ticket-type.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventStatus } from './enums';
import { Event } from './event.entity';
import { TicketType } from './ticket-type.entity';

export interface TicketTypeAvailability {
  ticketTypeId: string;
  name: string;
  quantity: number;
  reserved: number;
  available: number;
}

export interface EventAvailability {
  eventId: string;
  ticketTypes: TicketTypeAvailability[];
}

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private readonly eventsRepository: Repository<Event>,
    @InjectRepository(Reservation)
    private readonly reservationsRepository: Repository<Reservation>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(): Promise<Event[]> {
    return this.eventsRepository.find({
      where: { status: EventStatus.Active },
      relations: { ticketTypes: true },
      order: { updatedAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Event> {
    const event = await this.eventsRepository.findOne({
      where: { id, status: Not(EventStatus.Inactive) },
      relations: { ticketTypes: true },
    });
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    return event;
  }

  async getAvailability(id: string): Promise<EventAvailability> {
    const event = await this.findOne(id);
    const reservedByType = await this.sumReservedByTicketType(event.id);

    return {
      eventId: event.id,
      ticketTypes: event.ticketTypes.map((ticketType) => {
        const reserved = reservedByType.get(ticketType.id) ?? 0;
        return {
          ticketTypeId: ticketType.id,
          name: ticketType.name,
          quantity: ticketType.quantity,
          reserved,
          available: Math.max(0, ticketType.quantity - reserved),
        };
      }),
    };
  }

  async create(dto: CreateEventDto): Promise<Event> {
    return this.dataSource.transaction(async (manager) => {
      const event = manager.create(Event, {
        title: dto.title,
        description: dto.description ?? null,
        startsAt: new Date(dto.startsAt),
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        location: dto.location ?? null,
        status: EventStatus.Active,
      });
      const saved = await manager.save(event);

      const ticketTypes = dto.ticketTypes.map((item) =>
        manager.create(TicketType, {
          eventId: saved.id,
          name: item.name,
          price: new Decimal(item.price),
          currency: item.currency ?? 'NGN',
          quantity: item.quantity,
        }),
      );
      saved.ticketTypes = await manager.save(ticketTypes);
      return saved;
    });
  }

  async update(id: string, dto: UpdateEventDto): Promise<Event> {
    return this.dataSource.transaction(async (manager) => {
      const event = await manager.findOne(Event, {
        where: { id },
        relations: { ticketTypes: true },
      });
      if (!event) {
        throw new NotFoundException('Event not found');
      }

      if (dto.title !== undefined) {
        event.title = dto.title;
      }
      if (dto.description !== undefined) {
        event.description = dto.description;
      }
      if (dto.startsAt !== undefined) {
        event.startsAt = new Date(dto.startsAt);
      }
      if (dto.expiresAt !== undefined) {
        event.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
      }
      if (dto.location !== undefined) {
        event.location = dto.location;
      }
      if (dto.status !== undefined) {
        event.status = dto.status;
      }

      await manager.save(event);
      if (dto.ticketTypes !== undefined) {
        await this.syncTicketTypes(manager, event, dto.ticketTypes);
      }

      const updated = await manager.findOne(Event, {
        where: { id },
        relations: { ticketTypes: true },
      });
      if (!updated) {
        throw new NotFoundException('Event not found');
      }
      return updated;
    });
  }

  async remove(id: string): Promise<void> {
    const event = await this.eventsRepository.findOne({ where: { id } });
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    event.status = EventStatus.Inactive;
    await this.eventsRepository.save(event);
  }

  private async syncTicketTypes(
    manager: EntityManager,
    event: Event,
    items: TicketTypeDto[],
  ): Promise<void> {
    if (items.length === 0) {
      throw new BadRequestException('At least one ticket type is required');
    }

    const existingById = new Map(
      event.ticketTypes.map((ticketType) => [ticketType.id, ticketType]),
    );
    const keepIds = new Set<string>();

    for (const item of items) {
      if (item.id) {
        const existing = existingById.get(item.id);
        if (!existing) {
          throw new NotFoundException(
            `Ticket type ${item.id} not found for this event`,
          );
        }
        existing.name = item.name;
        existing.price = new Decimal(item.price);
        existing.currency = item.currency ?? 'NGN';
        existing.quantity = item.quantity;
        await manager.save(existing);
        keepIds.add(existing.id);
      } else {
        const created = await manager.save(
          manager.create(TicketType, {
            eventId: event.id,
            name: item.name,
            price: new Decimal(item.price),
            currency: item.currency ?? 'NGN',
            quantity: item.quantity,
          }),
        );
        keepIds.add(created.id);
      }
    }

    const toRemove = event.ticketTypes.filter(
      (ticketType) => !keepIds.has(ticketType.id),
    );
    if (toRemove.length === 0) {
      return;
    }

    const removeIds = toRemove.map((ticketType) => ticketType.id);
    const reservationCount = await manager.count(Reservation, {
      where: { ticketTypeId: In(removeIds) },
    });
    if (reservationCount > 0) {
      throw new ConflictException(
        'Cannot remove ticket types that have reservations',
      );
    }

    await manager.delete(TicketType, { id: In(removeIds) });
  }

  private async sumReservedByTicketType(
    eventId: string,
  ): Promise<Map<string, number>> {
    const rows = await this.reservationsRepository
      .createQueryBuilder('reservation')
      .select('reservation.ticket_type_id', 'ticketTypeId')
      .addSelect('COALESCE(SUM(reservation.quantity), 0)', 'reserved')
      .where('reservation.event_id = :eventId', { eventId })
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
      .groupBy('reservation.ticket_type_id')
      .getRawMany<{ ticketTypeId: string; reserved: string }>();

    return new Map(
      rows.map((row) => [row.ticketTypeId, Number(row.reserved)]),
    );
  }
}
