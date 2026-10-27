import { MigrationInterface, QueryRunner } from 'typeorm';

export class WebhookEventProviderContext1741500000000
  implements MigrationInterface
{
  name = 'WebhookEventProviderContext1741500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "webhook_events"
      ADD COLUMN "provider" character varying(32),
      ADD COLUMN "context" character varying(32)
    `);

    await queryRunner.query(`
      UPDATE "webhook_events"
      SET "provider" = 'bachs', "context" = 'payments'
      WHERE "provider" IS NULL OR "context" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "webhook_events"
      ALTER COLUMN "provider" SET NOT NULL,
      ALTER COLUMN "context" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "webhook_events"
      DROP CONSTRAINT "UQ_webhook_events_event_id"
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_webhook_events_provider_event_id"
      ON "webhook_events" ("provider", "event_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX "UQ_webhook_events_provider_event_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "webhook_events"
      ADD CONSTRAINT "UQ_webhook_events_event_id" UNIQUE ("event_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "webhook_events"
      DROP COLUMN "context",
      DROP COLUMN "provider"
    `);
  }
}
