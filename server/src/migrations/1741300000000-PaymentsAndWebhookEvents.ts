import { MigrationInterface, QueryRunner } from 'typeorm';

export class PaymentsAndWebhookEvents1741300000000
  implements MigrationInterface
{
  name = 'PaymentsAndWebhookEvents1741300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "payments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "reservation_id" uuid NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "currency" character varying(3) NOT NULL,
        "status" character varying(32) NOT NULL DEFAULT 'pending',
        "provider" character varying(32) NOT NULL DEFAULT 'bachs',
        "checkout_id" character varying(128) NOT NULL,
        "charge_id" character varying(128),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payments_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_payments_checkout_id" UNIQUE ("checkout_id"),
        CONSTRAINT "FK_payments_reservation_id" FOREIGN KEY ("reservation_id")
          REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "CHK_payments_amount_nonnegative" CHECK ("amount" >= 0),
        CONSTRAINT "CHK_payments_currency_format" CHECK ("currency" ~ '^[A-Z]{3}$'),
        CONSTRAINT "CHK_payments_status" CHECK (
          "status" IN ('pending', 'succeeded', 'failed')
        )
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_payments_reservation_id" ON "payments" ("reservation_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "webhook_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "event_id" character varying(128) NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_webhook_events_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_webhook_events_event_id" UNIQUE ("event_id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "webhook_events"`);
    await queryRunner.query(`DROP TABLE "payments"`);
  }
}
