import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReservationTicketTypeOpenIndex1741200000000
  implements MigrationInterface
{
  name = 'ReservationTicketTypeOpenIndex1741200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX "IDX_reservations_ticket_type_open"
      ON "reservations" ("ticket_type_id", "status")
      WHERE "status" IN ('held', 'confirmed')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_reservations_ticket_type_open"`,
    );
  }
}
