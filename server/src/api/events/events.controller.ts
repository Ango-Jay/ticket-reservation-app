import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Event } from './event.entity';
import { EventAvailability, EventsService } from './events.service';

@ApiTags('events')
@Controller()
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get('events')
  findAll(): Promise<Event[]> {
    return this.eventsService.findAll();
  }

  @Get('events/slug/:slug')
  findBySlug(@Param('slug') slug: string): Promise<Event> {
    return this.eventsService.findBySlug(slug);
  }

  @Get('events/:id/availability')
  getAvailability(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<EventAvailability> {
    return this.eventsService.getAvailability(id);
  }

  @Get('events/:id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Event> {
    return this.eventsService.findOne(id);
  }
}
