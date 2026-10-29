import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../admins/auth/jwt-auth.guard';
import { CreateEventDto } from './dto/create-event.dto';
import { CreateTicketTypeDto } from './dto/create-ticket-type.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { UpdateTicketTypeDto } from './dto/update-ticket-type.dto';
import { Event } from './event.entity';
import { EventsService } from './events.service';
import { TicketType } from './ticket-type.entity';

@ApiTags('admin-events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/events')
export class AdminEventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create event',
    description:
      'Admin. Requires Bearer (and `x-refresh-token` for silent refresh). Creates an event with at least one nested ticket type. Slug is optional and auto-derived from title when omitted.',
  })
  create(@Body() dto: CreateEventDto): Promise<Event> {
    return this.eventsService.create(dto);
  }

  @Post(':id/ticket-types')
  @ApiOperation({
    summary: 'Add ticket type',
    description:
      'Admin. Adds a ticket type to an existing event. Currency defaults to NGN when omitted.',
  })
  addTicketType(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTicketTypeDto,
  ): Promise<TicketType> {
    return this.eventsService.addTicketType(id, dto);
  }

  @Patch(':id/ticket-types/:ticketTypeId')
  @ApiOperation({
    summary: 'Update ticket type',
    description:
      'Admin. Partial update of name, price, currency, and/or quantity for a ticket type.',
  })
  updateTicketType(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('ticketTypeId', ParseUUIDPipe) ticketTypeId: string,
    @Body() dto: UpdateTicketTypeDto,
  ): Promise<TicketType> {
    return this.eventsService.updateTicketType(id, ticketTypeId, dto);
  }

  @Delete(':id/ticket-types/:ticketTypeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove ticket type',
    description:
      'Admin. Permanently removes a ticket type. Fails if it is the last ticket type on the event or if any reservations exist for it.',
  })
  async removeTicketType(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('ticketTypeId', ParseUUIDPipe) ticketTypeId: string,
  ): Promise<void> {
    await this.eventsService.removeTicketType(id, ticketTypeId);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update event',
    description:
      'Admin. Partial update including title, slug, schedule, location, and `status` (`active` | `expired` | `inactive`).',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEventDto,
  ): Promise<Event> {
    return this.eventsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Deactivate event',
    description:
      'Admin. Soft-deletes the event by setting `status` to `inactive`. Returns 204.',
  })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.eventsService.remove(id);
  }
}
