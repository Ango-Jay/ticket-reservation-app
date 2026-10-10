import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdminSessionsAndBlacklist1740000000000
  implements MigrationInterface
{
  name = 'AdminSessionsAndBlacklist1740000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "admin_sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "admin_id" uuid NOT NULL,
        "token_hash" character varying(64) NOT NULL,
        "previous_token_hash" character varying(64),
        "refresh_token_grace_expires_at" TIMESTAMPTZ,
        "expires_at" TIMESTAMPTZ NOT NULL,
        "revoked_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_admin_sessions_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_admin_sessions_token_hash" UNIQUE ("token_hash"),
        CONSTRAINT "UQ_admin_sessions_previous_token_hash" UNIQUE ("previous_token_hash"),
        CONSTRAINT "FK_admin_sessions_admin_id" FOREIGN KEY ("admin_id")
          REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_admin_sessions_admin_id" ON "admin_sessions" ("admin_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_admin_sessions_expires_at" ON "admin_sessions" ("expires_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE "admin_token_blacklist" (
        "jti" character varying(64) NOT NULL,
        "expires_at" TIMESTAMPTZ NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_admin_token_blacklist_jti" PRIMARY KEY ("jti")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_admin_token_blacklist_expires_at" ON "admin_token_blacklist" ("expires_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "admin_token_blacklist"`);
    await queryRunner.query(`DROP TABLE "admin_sessions"`);
  }
}
