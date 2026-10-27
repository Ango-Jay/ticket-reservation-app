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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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
  create(@Body() dto: CreateEventDto): Promise<Event> {
    return this.eventsService.create(dto);
  }

  @Post(':id/ticket-types')
  addTicketType(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTicketTypeDto,
  ): Promise<TicketType> {
    return this.eventsService.addTicketType(id, dto);
  }

  @Patch(':id/ticket-types/:ticketTypeId')
  updateTicketType(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('ticketTypeId', ParseUUIDPipe) ticketTypeId: string,
    @Body() dto: UpdateTicketTypeDto,
  ): Promise<TicketType> {
    return this.eventsService.updateTicketType(id, ticketTypeId, dto);
  }

  @Delete(':id/ticket-types/:ticketTypeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeTicketType(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('ticketTypeId', ParseUUIDPipe) ticketTypeId: string,
  ): Promise<void> {
    await this.eventsService.removeTicketType(id, ticketTypeId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEventDto,
  ): Promise<Event> {
    return this.eventsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.eventsService.remove(id);
  }
}
