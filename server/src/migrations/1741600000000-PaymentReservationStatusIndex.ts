import { MigrationInterface, QueryRunner } from 'typeorm';

export class PaymentReservationStatusIndex1741600000000
  implements MigrationInterface
{
  name = 'PaymentReservationStatusIndex1741600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX "IDX_payments_reservation_id_status"
      ON "payments" ("reservation_id", "status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX "IDX_payments_reservation_id_status"
    `);
  }
}
