import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentAdapter } from '../integrations/adapters/payment.adapter';
import { BachsModule } from '../integrations/bachs/bachs.module';
import { PAYMENT_PORT } from '../integrations/ports/payment.port';
import { Payment } from './payment.entity';
import { PaymentsService } from './payments.service';

@Module({
  imports: [TypeOrmModule.forFeature([Payment]), BachsModule],
  providers: [
    PaymentsService,
    PaymentAdapter,
    {
      provide: PAYMENT_PORT,
      useExisting: PaymentAdapter,
    },
  ],
  exports: [PaymentsService, TypeOrmModule],
})
export class PaymentsModule {}
