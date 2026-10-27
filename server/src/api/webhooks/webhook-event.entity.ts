import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PaymentProviderName } from '../payments/enums';
import { WebhookContext } from './enums';

@Entity({ name: 'webhook_events' })
@Index('UQ_webhook_events_provider_event_id', ['provider', 'eventId'], {
  unique: true,
})
export class WebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 32 })
  provider: PaymentProviderName;

  @Column({ type: 'varchar', length: 32 })
  context: WebhookContext;

  @Column({ name: 'event_id', type: 'varchar', length: 128 })
  eventId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
