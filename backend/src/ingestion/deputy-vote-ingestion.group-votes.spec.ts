import { readFileSync } from 'fs';
import { join } from 'path';
import { DeputyVoteIngestionService } from './deputy-vote-ingestion.service';
import { Law } from '../laws/law.entity';
import { VoteChoice } from '../votes/vote.types';

const scrutin = JSON.parse(readFileSync(join(__dirname, '..', 'votes', '__fixtures__', 'scrutin-an.json'), 'utf8'));

describe('DeputyVoteIngestionService — individual and group votes', () => {
    let deputies: Map<string, any>;
    let savedVotes: any[];
    let groupVotesService: any;
    let lawRepository: any;
    let service: DeputyVoteIngestionService;
    const law = Object.assign(new Law(), { id: 'law-1', externalId: 'DLR5L17N1' });

    beforeEach(() => {
        deputies = new Map();
        savedVotes = [];
        const deputyRepository = {
            findOne: jest.fn(async ({ where }) => deputies.get(where.anActeurRef) ?? null),
            create: jest.fn((d) => d),
            save: jest.fn(async (d) => {
                const saved = { id: `dep-${d.anActeurRef}`, ...d };
                deputies.set(d.anActeurRef, saved);
                return saved;
            }),
        };
        const officialVoteRepository = {
            findOne: jest.fn().mockResolvedValue(null),
            create: jest.fn((v) => v),
            save: jest.fn(async (v) => savedVotes.push(v)),
        };
        groupVotesService = { replaceForLaw: jest.fn().mockResolvedValue(3), hasGroupVotes: jest.fn().mockResolvedValue(false) };
        lawRepository = { createQueryBuilder: jest.fn() };
        service = new DeputyVoteIngestionService(
            {} as any,
            lawRepository,
            deputyRepository as any,
            officialVoteRepository as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            groupVotesService,
        );
    });

    it('stores one official vote per deputy listed in decompteNominatif', async () => {
        await (service as any).storeIndividualVotes(law, scrutin, 'VTANR5L17V1234', '2026-11-18');

        const byChoice = (c: VoteChoice) => savedVotes.filter((v) => v.choice === c).map((v) => v.deputy.anActeurRef).sort();
        expect(byChoice(VoteChoice.FOR)).toEqual(['PA1001', 'PA1002', 'PA1003', 'PA3001', 'PA3002']);
        expect(byChoice(VoteChoice.AGAINST)).toEqual(['PA1004', 'PA2001', 'PA2002']);
        expect(byChoice(VoteChoice.ABSTAIN)).toEqual(['PA3003']);
        expect(deputies.get('PA2001').groupePolitique).toBe('PO845413');
    });

    it('records the votes of each group for the law', async () => {
        await (service as any).storeIndividualVotes(law, scrutin, 'VTANR5L17V1234', '2026-11-18');

        const [calledLaw, scrutinId, groups] = groupVotesService.replaceForLaw.mock.calls[0];
        expect(calledLaw).toBe(law);
        expect(scrutinId).toBe('VTANR5L17V1234');
        expect(groups).toHaveLength(3);
    });

    it('stores choices on the law, not on the motion, for a motion de rejet', async () => {
        await (service as any).storeIndividualVotes(law, scrutin, 'VT', '2026-11-18', true);
        const pa1001 = savedVotes.find((v) => v.deputy.anActeurRef === 'PA1001');
        expect(pa1001.choice).toBe(VoteChoice.AGAINST);
    });

    it('backfills only resolved laws without group votes whose scrutin is still available', async () => {
        const resolved = Object.assign(new Law(), {
            id: 'law-2',
            externalId: 'X',
            deputyVoteResult: { scrutinId: 'VTANR5L17V1234', dateScrutin: '2026-11-18' },
        });
        const missing = Object.assign(new Law(), { id: 'law-3', externalId: 'Y', deputyVoteResult: { scrutinId: 'VT-OLD' } });
        lawRepository.createQueryBuilder.mockReturnValue({
            where: jest.fn().mockReturnThis(),
            getMany: jest.fn().mockResolvedValue([resolved, missing]),
        });
        jest.spyOn(service as any, 'fetchScrutins').mockResolvedValue([scrutin]);

        await expect(service.backfillGroupVotes()).resolves.toEqual({ updated: 1, notFound: 1 });
        expect(groupVotesService.replaceForLaw).toHaveBeenCalledTimes(1);
    });
});
