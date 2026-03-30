import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDescontoECidade1740000000000 implements MigrationInterface {
  name = 'AddDescontoECidade1740000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── beneficiarios: desconto individual do cliente ─────────────
    await queryRunner.query(`
      ALTER TABLE "beneficiarios"
      ADD COLUMN IF NOT EXISTS "desconto_percentual"
        DECIMAL(5,2) NOT NULL DEFAULT 0
    `);

    // ── usinas: cidade e estado para exibição no dashboard ────────
    await queryRunner.query(`
      ALTER TABLE "usinas"
      ADD COLUMN IF NOT EXISTS "cidade" VARCHAR,
      ADD COLUMN IF NOT EXISTS "estado" VARCHAR(2)
    `);

    // ── beneficiarios: colunas de FK explícitas (facilita queries) ─
    await queryRunner.query(`
      ALTER TABLE "beneficiarios"
      ADD COLUMN IF NOT EXISTS "usina_id" UUID,
      ADD COLUMN IF NOT EXISTS "cliente_id" UUID
    `);

    // Preenche as FKs a partir das relações existentes (se houver dados)
    await queryRunner.query(`
      UPDATE "beneficiarios" b
      SET "usina_id"   = (SELECT u.id FROM usinas u
                           JOIN beneficiarios bx ON bx.id = b.id
                           LIMIT 1),
          "cliente_id" = (SELECT c.id FROM clientes c
                           JOIN beneficiarios bx ON bx.id = b.id
                           LIMIT 1)
      WHERE "usina_id" IS NULL
    `).catch(() => {/* ignora se não tiver dados */});
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "beneficiarios" DROP COLUMN IF EXISTS "desconto_percentual"`);
    await queryRunner.query(`ALTER TABLE "beneficiarios" DROP COLUMN IF EXISTS "usina_id"`);
    await queryRunner.query(`ALTER TABLE "beneficiarios" DROP COLUMN IF EXISTS "cliente_id"`);
    await queryRunner.query(`ALTER TABLE "usinas" DROP COLUMN IF EXISTS "cidade"`);
    await queryRunner.query(`ALTER TABLE "usinas" DROP COLUMN IF EXISTS "estado"`);
  }
}