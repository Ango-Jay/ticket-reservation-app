import { join } from 'path';
import { DataSource } from 'typeorm';
import { Admin } from '../api/admins/admin.entity';
import { Event } from '../api/events/event.entity';
import { TicketType } from '../api/events/ticket-type.entity';
import { Reservation } from '../api/reservations/reservation.entity';
import { loadEnv } from './env';

loadEnv();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for TypeORM DataSource');
}

export default new DataSource({
  type: 'postgres',
  url: databaseUrl,
  entities: [Event, TicketType, Reservation, Admin],
  migrations: [join(__dirname, '..', 'migrations', '*.{ts,js}')],
});
