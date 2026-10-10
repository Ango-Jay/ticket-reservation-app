import { MigrationInterface, QueryRunner } from 'typeorm';

export class EventExpiresAt1741100000000 implements MigrationInterface {
  name = 'EventExpiresAt1741100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "events"
      ADD COLUMN "expires_at" TIMESTAMPTZ
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "expires_at"`);
  }
}
