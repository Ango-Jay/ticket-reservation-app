import { Transform } from 'class-transformer';
import Decimal from 'decimal.js';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { decimalTransformer } from '../../utils/decimal.transformer';
import { Reservation } from '../reservations/reservation.entity';
import { Event } from './event.entity';

@Entity({ name: 'ticket_types' })
@Index('IDX_ticket_types_event_id', ['eventId'])
export class TicketType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_id', type: 'uuid' })
  eventId: string;

  @ManyToOne(() => Event, (event) => event.ticketTypes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'event_id' })
  event: Event;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  @Transform(
    ({ value }: { value: Decimal }) =>
      value == null ? value : Number(new Decimal(value).toFixed(2)),
    { toPlainOnly: true },
  )
  price: Decimal;

  @Column({ type: 'varchar', length: 3, default: 'NGN' })
  currency: string;

  @Column({ type: 'int' })
  quantity: number;

  @OneToMany(() => Reservation, (reservation) => reservation.ticketType)
  reservations: Reservation[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
