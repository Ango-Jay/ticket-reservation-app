import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Decimal from 'decimal.js';
import { Repository } from 'typeorm';
import {
  PAYMENT_PORT,
  type CreateCheckoutResult,
  type PaymentPort,
} from '../integrations/ports/payment.port';
import { PaymentProviderName, PaymentStatus } from './enums';
import { Payment } from './payment.entity';

export interface StartCheckoutInput {
  reservationId: string;
  amount: Decimal;
  currency: string;
  email: string;
  reservationNumber: string;
  expiresInMinutes: number;
}

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentsRepository: Repository<Payment>,
    @Inject(PAYMENT_PORT)
    private readonly paymentPort: PaymentPort,
  ) {}

  async startCheckout(
    input: StartCheckoutInput,
  ): Promise<CreateCheckoutResult> {
    const pending = await this.paymentsRepository.findOne({
      where: {
        reservationId: input.reservationId,
        status: PaymentStatus.Pending,
      },
      order: { createdAt: 'DESC' },
    });
    if (pending?.checkoutUrl) {
      return {
        checkoutId: pending.checkoutId,
        checkoutUrl: pending.checkoutUrl,
      };
    }

    const created = await this.paymentPort.createCheckout({
      amount: input.amount.toFixed(2),
      currency: input.currency,
      email: input.email,
      reference: input.reservationNumber,
      metadata: {
        reservationId: input.reservationId,
        reservationNumber: input.reservationNumber,
      },
      expiresInMinutes: input.expiresInMinutes,
    });

    await this.paymentsRepository.save(
      this.paymentsRepository.create({
        reservationId: input.reservationId,
        amount: input.amount,
        currency: input.currency,
        status: PaymentStatus.Pending,
        provider: PaymentProviderName.Bachs,
        checkoutId: created.checkoutId,
        checkoutUrl: created.checkoutUrl,
        chargeId: null,
      }),
    );

    return created;
  }

  findByCheckoutId(checkoutId: string): Promise<Payment | null> {
    return this.paymentsRepository.findOne({ where: { checkoutId } });
  }

  async markSucceeded(
    payment: Payment,
    chargeId: string | null,
  ): Promise<Payment> {
    payment.status = PaymentStatus.Succeeded;
    payment.chargeId = chargeId;
    return this.paymentsRepository.save(payment);
  }

  async markFailed(payment: Payment): Promise<Payment> {
    payment.status = PaymentStatus.Failed;
    return this.paymentsRepository.save(payment);
  }
}
