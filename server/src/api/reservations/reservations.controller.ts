import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { Reservation } from './reservation.entity';
import { ReservationsService } from './reservations.service';

@ApiTags('reservations')
@Controller()
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Throttle({ default: { limit: 3, ttl: 60_000 } }) // 3 requests per minute
  @Post('events/:eventId/reservations')
  @ApiOperation({
    summary: 'Create reservation hold',
    description:
      'Public. Creates a `held` reservation with a short TTL (`expiresAt`). Body: `email`, `ticketTypeId`, `quantity`. Throttled to 3 requests/minute. May return 409 when inventory is insufficient or the email already has too many open holds for this event.',
  })
  create(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: CreateReservationDto,
  ): Promise<Reservation> {
    return this.reservationsService.create(eventId, dto);
  }

  @Get('reservations/:reservationNumber')
  @ApiOperation({
    summary: 'Get reservation by number',
    description:
      'Public. Returns the reservation with nested `event` and `ticketType`. Lazily expires past-due holds. Poll this after payment redirect until status is `confirmed`, `expired`, or `cancelled`.',
  })
  findOne(
    @Param('reservationNumber') reservationNumber: string,
  ): Promise<Reservation> {
    return this.reservationsService.findByNumber(reservationNumber);
  }

  @Throttle({ default: { limit: 3, ttl: 60_000 } }) // 3 requests per minute
  @Post('reservations/:reservationNumber/checkout')
  @ApiOperation({
    summary: 'Start checkout',
    description:
      'Public. For paid holds returns `{ checkoutId, checkoutUrl }` — redirect the browser to `checkoutUrl`. For free holds (`price * quantity === 0`) confirms immediately and returns the reservation with `status: "confirmed"`. Paid confirmation is completed by the payment webhook, not this client. Throttled to 3 requests/minute; checkout attempts are capped per reservation.',
  })
  checkout(@Param('reservationNumber') reservationNumber: string) {
    return this.reservationsService.checkout(reservationNumber);
  }

  /**
   * Deprecated. Kept for legacy clients.
   * Paid holds are confirmed by the payment webhook.
   */
  @ApiOperation({
    summary: 'Confirm free hold (deprecated)',
    deprecated: true,
    description:
      'Deprecated. Prefer `POST .../checkout`. Only confirms free holds; paid reservations return 409 because they are confirmed by the payment webhook.',
  })
  @Post('reservations/:reservationNumber/confirm')
  confirm(
    @Param('reservationNumber') reservationNumber: string,
  ): Promise<Reservation> {
    return this.reservationsService.confirm(reservationNumber);
  }

  @Post('reservations/:reservationNumber/cancel')
  @ApiOperation({
    summary: 'Cancel held reservation',
    description:
      'Public. Cancels a reservation only while it is still `held` (after lazy expiry). Releases inventory.',
  })
  cancel(
    @Param('reservationNumber') reservationNumber: string,
  ): Promise<Reservation> {
    return this.reservationsService.cancel(reservationNumber);
  }
}
