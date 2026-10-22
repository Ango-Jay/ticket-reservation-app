import { Injectable } from '@nestjs/common';
import { BachsService } from '../bachs/bachs.service';
import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  PaymentPort,
} from '../ports/payment.port';

@Injectable()
export class PaymentAdapter implements PaymentPort {
  constructor(private readonly bachsService: BachsService) {}

  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    return this.bachsService.createCheckoutSession({
      amount: input.amount,
      currency: input.currency,
      email: input.email,
      reference: input.reference,
      metadata: { ...input.metadata },
      expiresInMinutes: input.expiresInMinutes,
    });
  }
}
