import { MigrationInterface, QueryRunner } from 'typeorm';

export class EventStatus1741000000000 implements MigrationInterface {
  name = 'EventStatus1741000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "events"
      ADD COLUMN "status" character varying(32) NOT NULL DEFAULT 'active'
    `);

    await queryRunner.query(`
      ALTER TABLE "events"
      ADD CONSTRAINT "CHK_events_status"
      CHECK ("status" IN ('active', 'expired', 'inactive'))
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_events_status" ON "events" ("status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_events_status"`);
    await queryRunner.query(
      `ALTER TABLE "events" DROP CONSTRAINT "CHK_events_status"`,
    );
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "status"`);
  }
}
