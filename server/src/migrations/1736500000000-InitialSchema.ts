import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1736500000000 implements MigrationInterface {
  name = 'InitialSchema1736500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE "events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" character varying(255) NOT NULL,
        "slug" character varying(80) NOT NULL,
        "description" text,
        "starts_at" TIMESTAMPTZ NOT NULL,
        "location" character varying(255),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_events_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_events_slug" UNIQUE ("slug")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "ticket_types" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "event_id" uuid NOT NULL,
        "name" character varying(255) NOT NULL,
        "price" numeric(12,2) NOT NULL,
        "currency" character varying(3) NOT NULL DEFAULT 'NGN',
        "quantity" integer NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ticket_types_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ticket_types_event_id" FOREIGN KEY ("event_id")
          REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "CHK_ticket_types_quantity_nonnegative" CHECK ("quantity" >= 0),
        CONSTRAINT "CHK_ticket_types_price_nonnegative" CHECK ("price" >= 0),
        CONSTRAINT "CHK_ticket_types_currency_format" CHECK ("currency" ~ '^[A-Z]{3}$')
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_ticket_types_event_id" ON "ticket_types" ("event_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "reservations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "event_id" uuid NOT NULL,
        "ticket_type_id" uuid NOT NULL,
        "reservation_number" character varying(80) NOT NULL,
        "email" character varying(255) NOT NULL,
        "quantity" integer NOT NULL,
        "status" character varying(32) NOT NULL DEFAULT 'held',
        "expires_at" TIMESTAMPTZ NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reservations_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_reservations_reservation_number" UNIQUE ("reservation_number"),
        CONSTRAINT "FK_reservations_event_id" FOREIGN KEY ("event_id")
          REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_reservations_ticket_type_id" FOREIGN KEY ("ticket_type_id")
          REFERENCES "ticket_types"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT "CHK_reservations_quantity_positive" CHECK ("quantity" > 0),
        CONSTRAINT "CHK_reservations_status" CHECK (
          "status" IN ('held', 'confirmed', 'cancelled', 'expired')
        )
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_reservations_event_id" ON "reservations" ("event_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reservations_email" ON "reservations" ("email")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reservations_status_expires_at" ON "reservations" ("status", "expires_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE "admins" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying(255) NOT NULL,
        "password_hash" character varying(255),
        "google_sub" character varying(255),
        "first_name" character varying(255),
        "last_name" character varying(255),
        "status" character varying(32) NOT NULL DEFAULT 'pending',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_admins_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_admins_email" UNIQUE ("email"),
        CONSTRAINT "UQ_admins_google_sub" UNIQUE ("google_sub"),
        CONSTRAINT "CHK_admins_status" CHECK (
          "status" IN ('pending', 'active', 'inactive')
        )
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "admins"`);
    await queryRunner.query(`DROP TABLE "reservations"`);
    await queryRunner.query(`DROP TABLE "ticket_types"`);
    await queryRunner.query(`DROP TABLE "events"`);
  }
}
