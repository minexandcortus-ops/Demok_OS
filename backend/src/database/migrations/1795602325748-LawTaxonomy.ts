import { MigrationInterface, QueryRunner } from "typeorm";

export class LawTaxonomy1795602325748 implements MigrationInterface {
    name = 'LawTaxonomy1795602325748'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "law" ADD "territories" text array NOT NULL DEFAULT '{}'`);
        await queryRunner.query(`ALTER TABLE "law" ADD "categoriesLocked" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "law" ADD "classificationSource" character varying(16)`);
        // Reprise de l'ancien champ region (FRANCE | UE)
        await queryRunner.query(`UPDATE "law" SET "territories" = '{UE}' WHERE "region" = 'UE'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "law" DROP COLUMN "classificationSource"`);
        await queryRunner.query(`ALTER TABLE "law" DROP COLUMN "categoriesLocked"`);
        await queryRunner.query(`ALTER TABLE "law" DROP COLUMN "territories"`);
    }

}
