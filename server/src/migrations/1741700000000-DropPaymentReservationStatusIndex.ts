import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropPaymentReservationStatusIndex1741700000000
  implements MigrationInterface
{
  name = 'DropPaymentReservationStatusIndex1741700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_payments_reservation_id_status"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX "IDX_payments_reservation_id_status"
      ON "payments" ("reservation_id", "status")
    `);
  }
}
