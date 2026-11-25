import { join } from 'path';
import { DataSourceOptions } from 'typeorm';
import { Law } from '../laws/law.entity';
import { LawFavorite } from '../laws/law-favorite.entity';
import { User } from '../users/user.entity';
import { Citizen } from '../users/citizen.entity';
import { VoteRegistry } from '../votes/vote-registry.entity';
import { VoteUrna } from '../votes/vote-choice.entity';
import { Deputy } from '../votes/deputy.entity';
import { OfficialVote } from '../votes/official-vote.entity';
import { CitizenLevel } from '../gamification/entities/citizen-level.entity';
import { Category } from '../laws/category.entity';
import { Amendement } from '../laws/amendement.entity';
import { Candidate } from '../surveys/candidate.entity';
import { PresidentialVote } from '../surveys/presidential-vote.entity';
import { TopicPoll } from '../surveys/topic-poll.entity';
import { Report } from '../reports/entities/report.entity';
import { SurveyRegistry } from '../surveys/survey-registry.entity';
import { SurveyUrna } from '../surveys/survey-urna.entity';
import { GroupVote } from '../votes/group-vote.entity';

export const ENTITIES = [
    Law, LawFavorite, User, Citizen,
    VoteRegistry, VoteUrna, Deputy, OfficialVote,
    CitizenLevel, Category, Amendement, Candidate,
    PresidentialVote, TopicPoll,
    Report, SurveyRegistry, SurveyUrna, GroupVote,
];

/**
 * `synchronize` (création auto du schéma) :
 * - DB_SYNCHRONIZE=true|false si défini explicitement ;
 * - sinon actif hors production (comportement historique).
 * En production, le schéma est géré par les migrations (migrationsRun).
 */
export function shouldSynchronize(env: NodeJS.ProcessEnv): boolean {
    if (env.DB_SYNCHRONIZE !== undefined) return env.DB_SYNCHRONIZE === 'true';
    return env.NODE_ENV !== 'production';
}

/** .ts en dev (ts-node), .js une fois compilé (et jamais les .d.ts de dist/). */
const MIGRATIONS_EXT = __filename.endsWith('.ts') ? 'ts' : 'js';

export function buildTypeOrmOptions(env: NodeJS.ProcessEnv = process.env): DataSourceOptions {
    const synchronize = shouldSynchronize(env);
    return {
        type: 'postgres',
        host: env.DATABASE_HOST || 'localhost',
        port: parseInt(env.DATABASE_PORT || '5432', 10),
        username: env.DATABASE_USER || 'demok_user',
        password: env.DATABASE_PASSWORD || 'demok_password',
        database: env.DATABASE_NAME || 'demok_db',
        entities: ENTITIES,
        migrations: [join(__dirname, 'migrations', `*.${MIGRATIONS_EXT}`)],
        migrationsTableName: 'typeorm_migrations',
        synchronize,
        // synchronize et migrations s'excluent : on n'exécute les migrations que sans synchronize
        migrationsRun: !synchronize,
    };
}
