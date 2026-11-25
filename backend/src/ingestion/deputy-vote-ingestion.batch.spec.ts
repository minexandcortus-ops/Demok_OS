import { DeputyVoteIngestionService } from './deputy-vote-ingestion.service';
import { Law } from '../laws/law.entity';
import { VoteChoice } from '../votes/vote.types';

describe('DeputyVoteIngestionService.storeOfficialVotes (batched)', () => {
    const law = Object.assign(new Law(), { id: 'law-1', externalId: 'X' });
    let deputyRepository: any;
    let officialVoteRepository: any;
    let service: DeputyVoteIngestionService;

    beforeEach(() => {
        deputyRepository = {
            find: jest.fn(),
            create: jest.fn((d) => d),
            save: jest.fn(async (list: any[]) => list.map((d) => ({ id: `dep-${d.anActeurRef}`, ...d }))),
            findOne: jest.fn(),
        };
        officialVoteRepository = { find: jest.fn().mockResolvedValue([]), create: jest.fn((v) => v), save: jest.fn(), findOne: jest.fn() };
        service = new DeputyVoteIngestionService(
            {} as any, {} as any, deputyRepository, officialVoteRepository, {} as any, {} as any, {} as any, {} as any, {} as any,
        );
    });

    it('stores a full hemicycle (577 deputies) with a constant number of queries', async () => {
        const entries = Array.from({ length: 577 }, (_, i) => ({
            acteurRef: `PA${i}`,
            choice: i % 3 === 0 ? VoteChoice.FOR : i % 3 === 1 ? VoteChoice.AGAINST : VoteChoice.ABSTAIN,
            organeRef: `PO${i % 11}`,
        }));
        // la moitié des députés est déjà connue
        deputyRepository.find.mockResolvedValue(entries.filter((_, i) => i % 2 === 0).map((e) => ({ id: `dep-${e.acteurRef}`, anActeurRef: e.acteurRef })));

        const result = await service.storeOfficialVotes(law, entries, 'VT1', '2026-11-18');

        expect(result).toEqual({ created: 577, deputiesCreated: 288 });
        expect(deputyRepository.find).toHaveBeenCalledTimes(1);
        expect(deputyRepository.save).toHaveBeenCalledTimes(1);
        expect(officialVoteRepository.find).toHaveBeenCalledTimes(1);
        expect(officialVoteRepository.save).toHaveBeenCalledTimes(1);
        expect(officialVoteRepository.save.mock.calls[0][1]).toEqual({ chunk: 200 });
        expect(deputyRepository.findOne).not.toHaveBeenCalled();
        expect(officialVoteRepository.findOne).not.toHaveBeenCalled();
    });

    it('skips deputies who already have a vote on the law and ignores duplicates', async () => {
        deputyRepository.find.mockResolvedValue([{ id: 'dep-PA1', anActeurRef: 'PA1' }, { id: 'dep-PA2', anActeurRef: 'PA2' }]);
        officialVoteRepository.find.mockResolvedValue([{ deputy: { id: 'dep-PA1' } }]);

        const result = await service.storeOfficialVotes(
            law,
            [
                { acteurRef: 'PA1', choice: VoteChoice.FOR },
                { acteurRef: 'PA2', choice: VoteChoice.AGAINST },
                { acteurRef: 'PA2', choice: VoteChoice.FOR },
            ],
            'VT1',
            '2026-11-18',
        );

        expect(result).toEqual({ created: 1, deputiesCreated: 0 });
        const [saved] = officialVoteRepository.save.mock.calls[0];
        expect(saved).toHaveLength(1);
        expect(saved[0]).toMatchObject({ choice: VoteChoice.AGAINST, scrutinId: 'VT1' });
        expect(deputyRepository.save).not.toHaveBeenCalled();
    });

    it('creates unknown deputies with their group and scraped name', async () => {
        deputyRepository.find.mockResolvedValue([]);
        await service.storeOfficialVotes(law, [{ acteurRef: 'PA9', choice: VoteChoice.FOR, organeRef: 'PO1', fullName: 'Alice Martin' }], 'VT1', '2026-11-18');
        expect(deputyRepository.save.mock.calls[0][0][0]).toMatchObject({ anActeurRef: 'PA9', fullName: 'Alice Martin', groupePolitique: 'PO1' });
    });

    it('does nothing for an empty scrutin', async () => {
        await expect(service.storeOfficialVotes(law, [], 'VT1', '2026-11-18')).resolves.toEqual({ created: 0, deputiesCreated: 0 });
        expect(deputyRepository.find).not.toHaveBeenCalled();
    });
});
