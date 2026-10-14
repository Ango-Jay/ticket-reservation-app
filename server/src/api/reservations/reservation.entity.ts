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
import { Event } from '../events/event.entity';
import { TicketType } from '../events/ticket-type.entity';
import { ReservationStatus } from './enums';

@Entity({ name: 'reservations' })
@Index('IDX_reservations_event_id', ['eventId'])
@Index('IDX_reservations_email', ['email'])
@Index('IDX_reservations_held_expires_at', ['expiresAt'], {
  where: `"status" = 'held'`,
})
export class Reservation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'reservation_number',
    type: 'varchar',
    length: 80,
    unique: true,
  })
  reservationNumber: string;

  @Column({ name: 'event_id', type: 'uuid' })
  eventId: string;

  @ManyToOne(() => Event, (event) => event.reservations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'event_id' })
  event: Event;

  @Column({ name: 'ticket_type_id', type: 'uuid' })
  ticketTypeId: string;

  @ManyToOne(() => TicketType, (ticketType) => ticketType.reservations, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'ticket_type_id' })
  ticketType: TicketType;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'int' })
  quantity: number;

  @Column({
    type: 'varchar',
    length: 32,
    default: ReservationStatus.Held,
  })
  status: ReservationStatus;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
