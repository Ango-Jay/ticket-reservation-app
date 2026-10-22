import {
  Injectable,
  InternalServerErrorException,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import Decimal from 'decimal.js';
import { PaymentStatus } from '../../../payments/enums';
import { PaymentsService } from '../../../payments/payments.service';
import { ReservationsService } from '../../../reservations/reservations.service';
import type { BachsWebhookData } from '../../webhook.contract';

@Injectable()
export class CollectionSucceededHandler {
  private readonly logger = new Logger(CollectionSucceededHandler.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly reservationsService: ReservationsService,
  ) {}

  async handle(data: BachsWebhookData | undefined): Promise<void> {
    const checkoutId = data?.checkout_id;
    if (!checkoutId) {
      throw new UnprocessableEntityException('Webhook is missing checkout_id');
    }

    const payment = await this.paymentsService.findByCheckoutId(checkoutId);
    if (!payment) {
      throw new InternalServerErrorException('Payment not found for checkout');
    }

    if (payment.status !== PaymentStatus.Succeeded) {
      this.assertAmount(payment.amount, payment.currency, data);
      await this.paymentsService.markSucceeded(
        payment,
        data?.charge_id ?? null,
      );
    }

    const confirmed = await this.reservationsService.confirmPaidFromWebhook(
      payment.reservationId,
    );
    if (!confirmed) {
      this.logger.warn(
        `Payment ${payment.id} succeeded but reservation ${payment.reservationId} was not confirmed`,
      );
    }
  }

  private assertAmount(
    amount: Decimal,
    currency: string,
    data: BachsWebhookData | undefined,
  ): void {
    if (data?.amount == null || !data.currency) {
      throw new UnprocessableEntityException(
        'Webhook amount does not match payment',
      );
    }
    const webhookAmount = new Decimal(data.amount);
    if (!webhookAmount.equals(amount) || data.currency !== currency) {
      throw new UnprocessableEntityException(
        'Webhook amount does not match payment',
      );
    }
  }
}
