import { MigrationInterface, QueryRunner } from "typeorm";

export class GroupVotes1795601270689 implements MigrationInterface {
    name = 'GroupVotes1795601270689'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."group_vote_position_enum" AS ENUM('FOR', 'AGAINST', 'ABSTAIN', 'MIXED')`);
        await queryRunner.query(`CREATE TABLE "group_vote" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "scrutinId" character varying NOT NULL, "organeRef" character varying NOT NULL, "label" character varying NOT NULL, "pour" integer NOT NULL DEFAULT '0', "contre" integer NOT NULL DEFAULT '0', "abstention" integer NOT NULL DEFAULT '0', "nonVotants" integer NOT NULL DEFAULT '0', "position" "public"."group_vote_position_enum" NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "lawId" uuid, CONSTRAINT "UQ_30c45c3c93aaa3a774e16709dc5" UNIQUE ("lawId", "organeRef"), CONSTRAINT "PK_a5a56e266ba0028479e8980069c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "group_vote" ADD CONSTRAINT "FK_2a4c221ae6221ea9e98e4c06318" FOREIGN KEY ("lawId") REFERENCES "law"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "group_vote" DROP CONSTRAINT "FK_2a4c221ae6221ea9e98e4c06318"`);
        await queryRunner.query(`DROP TABLE "group_vote"`);
        await queryRunner.query(`DROP TYPE "public"."group_vote_position_enum"`);
    }

}
