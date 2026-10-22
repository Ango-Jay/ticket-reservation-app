import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsModule } from '../payments/payments.module';
import { ReservationsModule } from '../reservations/reservations.module';
import { BachsWebhookVerifier } from './providers/bachs/bachs-webhook.verifier';
import { CheckoutExpiredHandler } from './providers/bachs/checkout-expired.handler';
import { CollectionFailedHandler } from './providers/bachs/collection-failed.handler';
import { CollectionSucceededHandler } from './providers/bachs/collection-succeeded.handler';
import { WEBHOOK_VERIFIER } from './webhook.contract';
import { WebhookEvent } from './webhook-event.entity';
import { WebhooksController } from './webhooks.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([WebhookEvent]),
    PaymentsModule,
    ReservationsModule,
  ],
  controllers: [WebhooksController],
  providers: [
    BachsWebhookVerifier,
    {
      provide: WEBHOOK_VERIFIER,
      useExisting: BachsWebhookVerifier,
    },
    CollectionSucceededHandler,
    CollectionFailedHandler,
    CheckoutExpiredHandler,
  ],
})
export class WebhooksModule {}
