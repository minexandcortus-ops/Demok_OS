import { getMetadataArgsStorage } from 'typeorm';
import { RetireLegacyVotes1795602883692 } from './migrations/1795602883692-RetireLegacyVotes';
import { surveyVoterToken } from './vote-token';
import { SurveyRegistry } from '../surveys/survey-registry.entity';
import { SurveyUrna } from '../surveys/survey-urna.entity';
import { VoteUrna } from '../votes/vote-choice.entity';

const queryRunner = (legacy: any[], alreadyRegistered: string[] = []) => {
    const queries: Array<[string, any[]?]> = [];
    return {
        queries,
        hasTable: jest.fn().mockResolvedValue(true),
        hasColumn: jest.fn().mockResolvedValue(true),
        query: jest.fn(async (sql: string, params?: any[]) => {
            queries.push([sql, params]);
            if (sql.includes('FROM "presidential_vote"')) return legacy;
            if (sql.startsWith('SELECT 1 FROM "survey_registry"')) return alreadyRegistered.includes(params[1]) ? [{}] : [];
            return [];
        }),
    };
};

describe('RetireLegacyVotes migration', () => {
    const original = process.env.VOTE_SECRET;
    afterEach(() => (process.env.VOTE_SECRET = original));

    it('moves legacy presidential votes to registry + urn with the service token, then drops the table', async () => {
        process.env.VOTE_SECRET = 's3cret';
        const qr = queryRunner(
            [
                { citizenId: 'cit-a', candidateId: 'cand-1' },
                { citizenId: 'cit-b', candidateId: 'cand-1' },
            ],
            ['cit-b'],
        );

        await new RetireLegacyVotes1795602883692().up(qr as any);

        const urnInserts = qr.queries.filter(([sql]) => sql.startsWith('INSERT INTO "survey_urna"'));
        expect(urnInserts).toHaveLength(1); // cit-b avait déjà voté dans le nouveau système
        expect(urnInserts[0][1]).toEqual(['PRESIDENTIAL_2027', surveyVoterToken('s3cret', 'cit-a', 'PRESIDENTIAL_2027'), 'cand-1']);
        expect(qr.queries.some(([sql]) => sql === 'DROP TABLE "presidential_vote"')).toBe(true);
        expect(qr.queries.some(([sql]) => sql.includes('DROP COLUMN "voters"'))).toBe(true);
        expect(qr.queries.some(([sql]) => sql.includes('"vote_urna" ALTER COLUMN "createdAt" TYPE date'))).toBe(true);
        expect(qr.queries.some(([sql]) => sql.includes('ON DELETE CASCADE'))).toBe(true);
    });

    it('refuses to drop legacy votes without VOTE_SECRET', async () => {
        delete process.env.VOTE_SECRET;
        const qr = queryRunner([{ citizenId: 'cit-a', candidateId: 'cand-1' }]);
        await expect(new RetireLegacyVotes1795602883692().up(qr as any)).rejects.toThrow('VOTE_SECRET');
        expect(qr.queries.some(([sql]) => sql.startsWith('DROP TABLE'))).toBe(false);
    });

    it('does not need the secret when there is nothing to migrate', async () => {
        delete process.env.VOTE_SECRET;
        await expect(new RetireLegacyVotes1795602883692().up(queryRunner([]) as any)).resolves.toBeUndefined();
    });
});

describe('vote storage metadata', () => {
    const column = (target: Function, name: string) =>
        getMetadataArgsStorage().columns.find((c) => c.target === target && c.propertyName === name);

    it('stores only the day in ballot boxes', () => {
        expect(column(VoteUrna, 'createdAt').options.type).toBe('date');
        expect(column(SurveyUrna, 'createdAt').options.type).toBe('date');
    });

    it('removes the registry entry with the citizen (account deletion)', () => {
        const relation = getMetadataArgsStorage().relations.find((r) => r.target === SurveyRegistry && r.propertyName === 'citizen');
        expect(relation.options.onDelete).toBe('CASCADE');
    });
});
