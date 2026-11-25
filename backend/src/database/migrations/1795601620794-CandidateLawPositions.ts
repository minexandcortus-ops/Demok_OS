import { MigrationInterface, QueryRunner } from "typeorm";

export class CandidateLawPositions1795601620794 implements MigrationInterface {
    name = 'CandidateLawPositions1795601620794'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."candidate_law_position_position_enum" AS ENUM('POUR', 'CONTRE', 'ABSTENTION', 'NUANCE')`);
        await queryRunner.query(`CREATE TYPE "public"."candidate_law_position_sourcetype_enum" AS ENUM('DECLARATION', 'PROGRAMME')`);
        await queryRunner.query(`CREATE TABLE "candidate_law_position" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "position" "public"."candidate_law_position_position_enum" NOT NULL, "sourceType" "public"."candidate_law_position_sourcetype_enum" NOT NULL, "sourceUrl" character varying NOT NULL, "quote" character varying(300), "sourceDate" date NOT NULL, "verifiedBy" character varying NOT NULL, "verifiedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "candidateId" uuid, "lawId" uuid, CONSTRAINT "UQ_dfc5cd663cbf0406cf236f8d74b" UNIQUE ("candidateId", "lawId"), CONSTRAINT "PK_47246e298366e1c1fa659b22c5b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "candidate" ADD "deputyId" uuid`);
        await queryRunner.query(`ALTER TABLE "candidate" ADD "groupOrganeRef" character varying`);
        await queryRunner.query(`ALTER TABLE "candidate_law_position" ADD CONSTRAINT "FK_c0f70f38063c7cf6f4b8ad3f307" FOREIGN KEY ("candidateId") REFERENCES "candidate"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "candidate_law_position" ADD CONSTRAINT "FK_8841fd7a03fb04ecf1847413285" FOREIGN KEY ("lawId") REFERENCES "law"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "candidate_law_position" DROP CONSTRAINT "FK_8841fd7a03fb04ecf1847413285"`);
        await queryRunner.query(`ALTER TABLE "candidate_law_position" DROP CONSTRAINT "FK_c0f70f38063c7cf6f4b8ad3f307"`);
        await queryRunner.query(`ALTER TABLE "candidate" DROP COLUMN "groupOrganeRef"`);
        await queryRunner.query(`ALTER TABLE "candidate" DROP COLUMN "deputyId"`);
        await queryRunner.query(`DROP TABLE "candidate_law_position"`);
        await queryRunner.query(`DROP TYPE "public"."candidate_law_position_sourcetype_enum"`);
        await queryRunner.query(`DROP TYPE "public"."candidate_law_position_position_enum"`);
    }

}
