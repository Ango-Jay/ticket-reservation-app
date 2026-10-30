import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEventImageUrl1741800000000 implements MigrationInterface {
  name = 'AddEventImageUrl1741800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "events"
      ADD COLUMN "image_url" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "events"
      DROP COLUMN "image_url"
    `);
  }
}
