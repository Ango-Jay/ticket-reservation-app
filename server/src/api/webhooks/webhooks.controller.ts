import {
  Controller,
  HttpCode,
  Inject,
  InternalServerErrorException,
  Post,
  Req,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import { isUniqueViolation } from '../../utils/postgres-errors';
import { PaymentProviderName } from '../payments/enums';
import { WebhookContext } from './enums';
import { CheckoutExpiredHandler } from './providers/bachs/checkout-expired.handler';
import { CollectionFailedHandler } from './providers/bachs/collection-failed.handler';
import { CollectionSucceededHandler } from './providers/bachs/collection-succeeded.handler';
import {
  WEBHOOK_VERIFIER,
  type BachsWebhookPayload,
  type WebhookVerifier,
} from './webhook.contract';
import { WebhookEvent } from './webhook-event.entity';

@ApiExcludeController()
@Controller('webhooks')
export class WebhooksController {
  constructor(
    @Inject(WEBHOOK_VERIFIER)
    private readonly webhookVerifier: WebhookVerifier,
    @InjectRepository(WebhookEvent)
    private readonly webhookEventsRepository: Repository<WebhookEvent>,
    private readonly collectionSucceededHandler: CollectionSucceededHandler,
    private readonly collectionFailedHandler: CollectionFailedHandler,
    private readonly checkoutExpiredHandler: CheckoutExpiredHandler,
  ) {}

  @SkipThrottle()
  @Post('bachs')
  @HttpCode(200)
  async bachs(
    @Req() request: RawBodyRequest<Request>,
  ): Promise<{ received: true }> {
    const rawBody = request.rawBody;
    if (!rawBody) {
      throw new InternalServerErrorException('Missing webhook body');
    }

    this.webhookVerifier.verifyWebhookSecret(rawBody, {
      signatureV2: this.header(request, 'x-bachs-signature-v2'),
      timestamp: this.header(request, 'x-bachs-timestamp'),
    });

    const payload = this.parsePayload(rawBody);
    const existing = await this.webhookEventsRepository.findOne({
      where: {
        eventId: payload.id,
        provider: PaymentProviderName.Bachs,
      },
    });
    if (existing) {
      return { received: true };
    }

    await this.dispatch(payload);

    try {
      await this.webhookEventsRepository.save(
        this.webhookEventsRepository.create({
          eventId: payload.id,
          provider: PaymentProviderName.Bachs,
          context: WebhookContext.Payments,
        }),
      );
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
    }

    return { received: true };
  }

  private async dispatch(payload: BachsWebhookPayload): Promise<void> {
    switch (payload.type) {
      case 'collection.succeeded':
        await this.collectionSucceededHandler.handle(payload.data);
        return;
      case 'collection.failed':
        await this.collectionFailedHandler.handle(payload.data);
        return;
      case 'checkout.expired':
        await this.checkoutExpiredHandler.handle(payload.data);
        return;
      default:
        return;
    }
  }

  private parsePayload(rawBody: Buffer): BachsWebhookPayload {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody.toString('utf8')) as unknown;
    } catch {
      throw new UnprocessableEntityException('Webhook body is not JSON');
    }
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('id' in parsed) ||
      typeof parsed.id !== 'string' ||
      !('type' in parsed) ||
      typeof parsed.type !== 'string'
    ) {
      throw new UnprocessableEntityException('Webhook payload is invalid');
    }
    return parsed as BachsWebhookPayload;
  }

  private header(request: Request, name: string): string | undefined {
    const value = request.headers[name];
    return Array.isArray(value) ? value[0] : value;
  }
}
