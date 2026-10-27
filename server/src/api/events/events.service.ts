import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Decimal from 'decimal.js';
import { DataSource, EntityManager, Not, Repository } from 'typeorm';
import { randomAlphanumeric, slugify } from '../../utils/slugify';
import { ReservationStatus } from '../reservations/enums';
import { Reservation } from '../reservations/reservation.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { CreateTicketTypeDto } from './dto/create-ticket-type.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { UpdateTicketTypeDto } from './dto/update-ticket-type.dto';
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
    @InjectRepository(TicketType)
    private readonly ticketTypesRepository: Repository<TicketType>,
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

  async findBySlug(slug: string): Promise<Event> {
    const event = await this.eventsRepository.findOne({
      where: { slug, status: Not(EventStatus.Inactive) },
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
      const slug = await this.resolveUniqueSlug(
        manager,
        dto.slug ?? slugify(dto.title),
      );
      const event = manager.create(Event, {
        title: dto.title,
        slug,
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
      if (dto.slug !== undefined) {
        event.slug = await this.resolveUniqueSlug(manager, dto.slug, event.id);
      } else if (dto.title !== undefined) {
        event.slug = await this.resolveUniqueSlug(
          manager,
          slugify(dto.title),
          event.id,
        );
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

  async addTicketType(
    eventId: string,
    dto: CreateTicketTypeDto,
  ): Promise<TicketType> {
    const event = await this.eventsRepository.findOne({
      where: { id: eventId },
    });
    if (!event) {
      throw new NotFoundException('Event not found');
    }

    return this.ticketTypesRepository.save(
      this.ticketTypesRepository.create({
        eventId: event.id,
        name: dto.name,
        price: new Decimal(dto.price),
        currency: dto.currency ?? 'NGN',
        quantity: dto.quantity,
      }),
    );
  }

  async updateTicketType(
    eventId: string,
    ticketTypeId: string,
    dto: UpdateTicketTypeDto,
  ): Promise<TicketType> {
    const ticketType = await this.requireTicketTypeForEvent(
      eventId,
      ticketTypeId,
    );

    if (dto.name !== undefined) {
      ticketType.name = dto.name;
    }
    if (dto.price !== undefined) {
      ticketType.price = new Decimal(dto.price);
    }
    if (dto.currency !== undefined) {
      ticketType.currency = dto.currency;
    }
    if (dto.quantity !== undefined) {
      ticketType.quantity = dto.quantity;
    }

    return this.ticketTypesRepository.save(ticketType);
  }

  async removeTicketType(
    eventId: string,
    ticketTypeId: string,
  ): Promise<void> {
    const ticketType = await this.requireTicketTypeForEvent(
      eventId,
      ticketTypeId,
    );

    const ticketTypeCount = await this.ticketTypesRepository.count({
      where: { eventId },
    });
    if (ticketTypeCount <= 1) {
      throw new BadRequestException('At least one ticket type is required');
    }

    const reservationCount = await this.reservationsRepository.count({
      where: { ticketTypeId: ticketType.id },
    });
    if (reservationCount > 0) {
      throw new ConflictException(
        'Cannot remove ticket types that have reservations',
      );
    }

    await this.ticketTypesRepository.delete({ id: ticketType.id });
  }

  private async requireTicketTypeForEvent(
    eventId: string,
    ticketTypeId: string,
  ): Promise<TicketType> {
    const event = await this.eventsRepository.findOne({
      where: { id: eventId },
    });
    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const ticketType = await this.ticketTypesRepository.findOne({
      where: { id: ticketTypeId, eventId },
    });
    if (!ticketType) {
      throw new NotFoundException('Ticket type not found for this event');
    }
    return ticketType;
  }

  private async resolveUniqueSlug(
    manager: EntityManager,
    base: string,
    excludeEventId?: string,
  ): Promise<string> {
    const normalized = slugify(base);
    let candidate = normalized;
    let attempt = 0;

    while (attempt < 20) {
      const existing = await manager.findOne(Event, {
        where: { slug: candidate },
      });
      if (!existing || existing.id === excludeEventId) {
        return candidate;
      }
      attempt += 1;
      candidate = slugify(`${normalized}-${randomAlphanumeric(4).toLowerCase()}`);
    }

    throw new ConflictException('Unable to allocate a unique event slug');
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
