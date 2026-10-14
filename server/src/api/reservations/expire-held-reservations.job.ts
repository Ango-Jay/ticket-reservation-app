import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { ReservationStatus } from './enums';
import { Reservation } from './reservation.entity';

/** Stable Postgres advisory lock key for this job (transaction-scoped). */
const EXPIRE_HELD_RESERVATIONS_LOCK_ID = 748291037;

@Injectable()
export class ExpireHeldReservationsJob {
  private readonly logger = new Logger(ExpireHeldReservationsJob.name);

  constructor(private readonly dataSource: DataSource) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleCron(): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const [{ pg_try_advisory_xact_lock: acquired }] = (await manager.query(
        'SELECT pg_try_advisory_xact_lock($1)',
        [EXPIRE_HELD_RESERVATIONS_LOCK_ID],
      )) as [{ pg_try_advisory_xact_lock: boolean }];

      if (!acquired) {
        this.logger.debug(
          'Another instance is already running the expiration job. Skipping.',
        );
        return;
      }

      const result = await manager
        .createQueryBuilder()
        .update(Reservation)
        .set({ status: ReservationStatus.Expired })
        .where('status = :held', { held: ReservationStatus.Held })
        .andWhere('expires_at < NOW()')
        .execute();

      this.logger.log(
        `Expired ${result.affected ?? 0} past-due held reservation(s)`,
      );
    });
  }
}
