import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Event } from './event.entity';
import { EventAvailability, EventsService } from './events.service';

@ApiTags('events')
@Controller()
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get('events')
  @ApiOperation({
    summary: 'List active events',
    description:
      'Public. Returns active events only, each including nested `ticketTypes`. Soft-deleted (`inactive`) events are omitted.',
  })
  findAll(): Promise<Event[]> {
    return this.eventsService.findAll();
  }

  @Get('events/slug/:slug')
  @ApiOperation({
    summary: 'Get event by slug',
    description:
      'Public. Preferred for customer-facing URLs. Returns the event with `ticketTypes` when it is not inactive.',
  })
  findBySlug(@Param('slug') slug: string): Promise<Event> {
    return this.eventsService.findBySlug(slug);
  }

  @Get('events/:id/availability')
  @ApiOperation({
    summary: 'Get ticket availability for an event',
    description:
      'Public. Per ticket type: `quantity`, `reserved` (held + confirmed), and `available`. Use before creating a hold.',
  })
  getAvailability(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<EventAvailability> {
    return this.eventsService.getAvailability(id);
  }

  @Get('events/:id')
  @ApiOperation({
    summary: 'Get event by ID',
    description:
      'Public. Returns the event with `ticketTypes` when it is not inactive.',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Event> {
    return this.eventsService.findOne(id);
  }
}
