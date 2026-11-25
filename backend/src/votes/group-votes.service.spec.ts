import { GroupVotesService } from './group-votes.service';
import { GroupPosition } from './group-vote.entity';
import { Law } from '../laws/law.entity';

describe('GroupVotesService', () => {
    let groupVoteRepository: any;
    let deputyRepository: any;
    let officialVoteRepository: any;
    let service: GroupVotesService;
    const law = Object.assign(new Law(), { id: 'law-1', externalId: 'DLR5L17N1' });

    beforeEach(() => {
        groupVoteRepository = {
            create: jest.fn((x) => x),
            save: jest.fn(async (x) => x),
            delete: jest.fn(),
            find: jest.fn(),
            count: jest.fn(),
        };
        deputyRepository = { find: jest.fn(), update: jest.fn() };
        officialVoteRepository = { find: jest.fn() };
        service = new GroupVotesService(groupVoteRepository, deputyRepository, officialVoteRepository);
    });

    it('replaces the groups of a law, deriving missing labels from the deputies', async () => {
        deputyRepository.find.mockResolvedValue([
            { anActeurRef: 'PA1', party: 'Socialistes et apparentés' },
            { anActeurRef: 'PA2', party: 'Socialistes et apparentés' },
        ]);

        const count = await service.replaceForLaw(law, 'VT1', [
            { organeRef: 'PO1', pour: 2, contre: 0, abstention: 0, nonVotants: 0, position: GroupPosition.FOR, nominatif: { FOR: ['PA1', 'PA2'], AGAINST: [], ABSTAIN: [] } },
            { organeRef: 'PO2', label: 'Groupe scrapé', pour: 0, contre: 1, abstention: 0, nonVotants: 0, position: GroupPosition.AGAINST, nominatif: { FOR: [], AGAINST: ['PA9'], ABSTAIN: [] } },
        ]);

        expect(count).toBe(2);
        expect(groupVoteRepository.delete).toHaveBeenCalledWith({ law: { id: 'law-1' } });
        const saved = groupVoteRepository.save.mock.calls[0][0];
        expect(saved.map((g: any) => g.label)).toEqual(['Socialistes et apparentés', 'Groupe scrapé']);
        expect(deputyRepository.update).toHaveBeenCalledTimes(2);
        expect(deputyRepository.update.mock.calls[0][1]).toEqual({ groupePolitique: 'PO1' });
    });

    it('does nothing without groups (e.g. vote à main levée)', async () => {
        await expect(service.replaceForLaw(law, 'VT1', [])).resolves.toBe(0);
        expect(groupVoteRepository.delete).not.toHaveBeenCalled();
    });

    it('returns groups by size with their dissidents', async () => {
        groupVoteRepository.find.mockResolvedValue([
            { scrutinId: 'VT1', organeRef: 'PO2', label: 'Petit', pour: 1, contre: 0, abstention: 0, nonVotants: 0, position: GroupPosition.FOR },
            { scrutinId: 'VT1', organeRef: 'PO1', label: 'Grand', pour: 3, contre: 1, abstention: 0, nonVotants: 0, position: GroupPosition.FOR },
        ]);
        officialVoteRepository.find.mockResolvedValue([
            { choice: 'FOR', deputy: { id: 'd1', fullName: 'Alice A', groupePolitique: 'PO1' } },
            { choice: 'AGAINST', deputy: { id: 'd2', fullName: 'Bruno B', groupePolitique: 'PO1' } },
            { choice: 'FOR', deputy: { id: 'd3', fullName: 'Chloé C', groupePolitique: 'PO2' } },
        ]);

        const result = await service.getForLaw('law-1');

        expect(result.scrutinId).toBe('VT1');
        expect(result.groups.map((g) => g.label)).toEqual(['Grand', 'Petit']);
        expect(result.groups[0].dissidents).toEqual([{ deputyId: 'd2', fullName: 'Bruno B', choice: 'AGAINST' }]);
        expect(result.groups[1].dissidents).toEqual([]);
    });

    it('returns an empty list for a law without group votes', async () => {
        groupVoteRepository.find.mockResolvedValue([]);
        await expect(service.getForLaw('law-1')).resolves.toEqual({ scrutinId: null, groups: [] });
        expect(officialVoteRepository.find).not.toHaveBeenCalled();
    });
});
