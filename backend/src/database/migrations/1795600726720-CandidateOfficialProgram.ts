import { MigrationInterface, QueryRunner } from "typeorm";

export class CandidateOfficialProgram1795600726720 implements MigrationInterface {
    name = 'CandidateOfficialProgram1795600726720'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."candidate_status_enum" AS ENUM('PRESSENTI', 'DECLARE', 'OFFICIEL', 'RETIRE', 'MASQUE')`);
        await queryRunner.query(`ALTER TABLE "candidate" ADD "status" "public"."candidate_status_enum" NOT NULL DEFAULT 'DECLARE'`);
        await queryRunner.query(`ALTER TABLE "candidate" ADD "officialSiteUrl" character varying`);
        await queryRunner.query(`ALTER TABLE "candidate" ADD "officialProgramUrl" character varying`);
        await queryRunner.query(`CREATE TYPE "public"."candidate_programstatus_enum" AS ENUM('NON_PUBLIE', 'PARTIEL', 'PUBLIE')`);
        await queryRunner.query(`ALTER TABLE "candidate" ADD "programStatus" "public"."candidate_programstatus_enum" NOT NULL DEFAULT 'NON_PUBLIE'`);
        await queryRunner.query(`ALTER TABLE "candidate" ADD "programPublishedAt" date`);
        await queryRunner.query(`ALTER TABLE "candidate" ADD "linksCheckedAt" TIMESTAMP`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "candidate" DROP COLUMN "linksCheckedAt"`);
        await queryRunner.query(`ALTER TABLE "candidate" DROP COLUMN "programPublishedAt"`);
        await queryRunner.query(`ALTER TABLE "candidate" DROP COLUMN "programStatus"`);
        await queryRunner.query(`DROP TYPE "public"."candidate_programstatus_enum"`);
        await queryRunner.query(`ALTER TABLE "candidate" DROP COLUMN "officialProgramUrl"`);
        await queryRunner.query(`ALTER TABLE "candidate" DROP COLUMN "officialSiteUrl"`);
        await queryRunner.query(`ALTER TABLE "candidate" DROP COLUMN "status"`);
        await queryRunner.query(`DROP TYPE "public"."candidate_status_enum"`);
    }

}
