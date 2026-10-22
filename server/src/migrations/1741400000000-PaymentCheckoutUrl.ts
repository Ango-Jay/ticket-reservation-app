import { MigrationInterface, QueryRunner } from 'typeorm';

export class PaymentCheckoutUrl1741400000000 implements MigrationInterface {
  name = 'PaymentCheckoutUrl1741400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "payments"
      ADD COLUMN "checkout_url" character varying(512)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "payments" DROP COLUMN "checkout_url"
    `);
  }
}
