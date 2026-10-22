import {
  Injectable,
  InternalServerErrorException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PaymentStatus } from '../../../payments/enums';
import { PaymentsService } from '../../../payments/payments.service';
import type { BachsWebhookData } from '../../webhook.contract';

@Injectable()
export class CheckoutExpiredHandler {
  constructor(private readonly paymentsService: PaymentsService) {}

  async handle(data: BachsWebhookData | undefined): Promise<void> {
    const checkoutId = data?.checkout_id;
    if (!checkoutId) {
      throw new UnprocessableEntityException('Webhook is missing checkout_id');
    }

    const payment = await this.paymentsService.findByCheckoutId(checkoutId);
    if (!payment) {
      throw new InternalServerErrorException('Payment not found for checkout');
    }
    if (payment.status !== PaymentStatus.Pending) {
      return;
    }
    await this.paymentsService.markFailed(payment);
  }
}
