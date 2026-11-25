import { MigrationInterface, QueryRunner } from 'typeorm';
import { surveyVoterToken } from '../vote-token';

const PRESIDENTIAL_SURVEY_ID = 'PRESIDENTIAL_2027';

/**
 * Retire les stockages de vote qui liaient directement un utilisateur à son choix :
 * 1. `presidential_vote` (userId + candidateId en clair) → registre + urne, puis suppression de la table ;
 * 2. `topic_poll.voters` (liste d'identifiants d'utilisateurs) → registre, puis suppression de la colonne
 *    (les compteurs agrégés votePour/voteNeutre/voteContre sont conservés) ;
 * 3. horodatage des urnes réduit au jour (plus de rapprochement possible avec l'heure d'inscription) ;
 * 4. survey_registry → citizen en ON DELETE CASCADE (la suppression d'un compte échouait).
 */
export class RetireLegacyVotes1795602883692 implements MigrationInterface {
    name = 'RetireLegacyVotes1795602883692';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Ancien vote présidentiel
        if (await queryRunner.hasTable('presidential_vote')) {
            const legacy: Array<{ citizenId: string; candidateId: string }> = await queryRunner.query(`
                SELECT c."id" AS "citizenId", pv."candidateId" AS "candidateId"
                FROM "presidential_vote" pv
                JOIN "citizen" c ON c."userId" = pv."userId"
                WHERE pv."candidateId" IS NOT NULL`);

            if (legacy.length) {
                const secret = process.env.VOTE_SECRET;
                if (!secret) {
                    throw new Error('VOTE_SECRET est requis pour migrer les anciens votes présidentiels');
                }
                for (const { citizenId, candidateId } of legacy) {
                    const [already] = await queryRunner.query(
                        `SELECT 1 FROM "survey_registry" WHERE "surveyId" = $1 AND "citizenId" = $2`,
                        [PRESIDENTIAL_SURVEY_ID, citizenId],
                    );
                    if (already) continue; // le nouveau système fait foi
                    await queryRunner.query(
                        `INSERT INTO "survey_registry" ("surveyId", "surveyType", "citizenId", "createdAt")
                         VALUES ($1, 'PRESIDENTIAL', $2, date_trunc('day', now()))`,
                        [PRESIDENTIAL_SURVEY_ID, citizenId],
                    );
                    await queryRunner.query(
                        `INSERT INTO "survey_urna" ("surveyId", "voterToken", "choiceId") VALUES ($1, $2, $3)`,
                        [PRESIDENTIAL_SURVEY_ID, surveyVoterToken(secret, citizenId, PRESIDENTIAL_SURVEY_ID), candidateId],
                    );
                }
            }
            await queryRunner.query(`DROP TABLE "presidential_vote"`);
        }

        // 2. Anciens votants des sondages thématiques → registre (anti double vote)
        if (await queryRunner.hasColumn('topic_poll', 'voters')) {
            await queryRunner.query(`
                INSERT INTO "survey_registry" ("surveyId", "surveyType", "citizenId", "createdAt")
                SELECT DISTINCT tp."id"::text, 'TOPIC', c."id", date_trunc('day', now())
                FROM "topic_poll" tp
                CROSS JOIN LATERAL unnest(string_to_array(tp."voters", ',')) AS legacy("userId")
                JOIN "citizen" c ON c."userId"::text = trim(legacy."userId")
                WHERE trim(legacy."userId") <> ''
                  AND NOT EXISTS (
                      SELECT 1 FROM "survey_registry" sr WHERE sr."surveyId" = tp."id"::text AND sr."citizenId" = c."id"
                  )`);
            await queryRunner.query(`ALTER TABLE "topic_poll" DROP COLUMN "voters"`);
        }

        // 3. Urnes : jour seulement
        await queryRunner.query(`ALTER TABLE "vote_urna" ALTER COLUMN "createdAt" TYPE date USING "createdAt"::date`);
        await queryRunner.query(`ALTER TABLE "vote_urna" ALTER COLUMN "createdAt" SET DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "survey_urna" ALTER COLUMN "createdAt" TYPE date USING "createdAt"::date`);
        await queryRunner.query(`ALTER TABLE "survey_urna" ALTER COLUMN "createdAt" SET DEFAULT now()`);

        // 4. Suppression de compte : le registre suit le citoyen
        await queryRunner.query(`ALTER TABLE "survey_registry" DROP CONSTRAINT IF EXISTS "FK_04b949045e73780fadf61531acd"`);
        await queryRunner.query(`ALTER TABLE "survey_registry" ADD CONSTRAINT "FK_04b949045e73780fadf61531acd" FOREIGN KEY ("citizenId") REFERENCES "citizen"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Les liens utilisateur ↔ choix supprimés ne sont volontairement pas recréés.
        await queryRunner.query(`ALTER TABLE "survey_registry" DROP CONSTRAINT "FK_04b949045e73780fadf61531acd"`);
        await queryRunner.query(`ALTER TABLE "survey_registry" ADD CONSTRAINT "FK_04b949045e73780fadf61531acd" FOREIGN KEY ("citizenId") REFERENCES "citizen"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "survey_urna" ALTER COLUMN "createdAt" TYPE TIMESTAMP USING "createdAt"::timestamp`);
        await queryRunner.query(`ALTER TABLE "vote_urna" ALTER COLUMN "createdAt" TYPE TIMESTAMP USING "createdAt"::timestamp`);
        await queryRunner.query(`ALTER TABLE "topic_poll" ADD "voters" text NOT NULL DEFAULT ''`);
        await queryRunner.query(`CREATE TABLE "presidential_vote" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" uuid, "candidateId" uuid, CONSTRAINT "PK_62ceda3aa6f4beb158fcd3f028e" PRIMARY KEY ("id"))`);
    }
}
