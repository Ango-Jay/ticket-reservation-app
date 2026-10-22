import Decimal from 'decimal.js';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { decimalTransformer } from '../../utils/decimal.transformer';
import { Reservation } from '../reservations/reservation.entity';
import { PaymentProviderName, PaymentStatus } from './enums';

@Entity({ name: 'payments' })
@Index('IDX_payments_reservation_id', ['reservationId'])
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'reservation_id', type: 'uuid' })
  reservationId: string;

  @ManyToOne(() => Reservation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reservation_id' })
  reservation: Reservation;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  amount: Decimal;

  @Column({ type: 'varchar', length: 3 })
  currency: string;

  @Column({ type: 'varchar', length: 32, default: PaymentStatus.Pending })
  status: PaymentStatus;

  @Column({ type: 'varchar', length: 32, default: PaymentProviderName.Bachs })
  provider: PaymentProviderName;

  @Column({ name: 'checkout_id', type: 'varchar', length: 128, unique: true })
  checkoutId: string;

  @Column({ name: 'checkout_url', type: 'varchar', length: 512, nullable: true })
  checkoutUrl: string | null;

  @Column({ name: 'charge_id', type: 'varchar', length: 128, nullable: true })
  chargeId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
