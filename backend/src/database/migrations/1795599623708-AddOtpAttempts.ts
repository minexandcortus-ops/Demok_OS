import { MigrationInterface, QueryRunner } from "typeorm";

/** Compteur de tentatives OTP. IF NOT EXISTS : la colonne peut déjà avoir été créée par synchronize. */
export class AddOtpAttempts1795599623708 implements MigrationInterface {
    name = 'AddOtpAttempts1795599623708'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "otpAttempts" integer NOT NULL DEFAULT '0'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "otpAttempts"`);
    }

}
