import { NotFoundException } from '@nestjs/common';
import { CandidatePositionsService } from './candidate-positions.service';
import { PositionSourceType } from './candidate-positions';

describe('CandidatePositionsService', () => {
    const candidates = [
        { id: 'c-deputy', name: 'Bernard Député', party: 'Parti A', deputyId: 'dep-1', groupOrganeRef: 'PO1' },
        { id: 'c-declared', name: 'Anne Déclarée', party: 'Parti B', deputyId: null, groupOrganeRef: 'PO2' },
        { id: 'c-group', name: 'Claire Groupe', party: 'Parti C', deputyId: null, groupOrganeRef: 'PO2' },
        { id: 'c-none', name: 'David Inconnu', party: 'Parti D', deputyId: null, groupOrganeRef: null },
    ];
    let repos: Record<string, any>;
    let service: CandidatePositionsService;

    beforeEach(() => {
        repos = {
            candidate: { find: jest.fn().mockResolvedValue(candidates), findOne: jest.fn() },
            position: { find: jest.fn(), findOne: jest.fn(), create: jest.fn((x) => x), save: jest.fn(async (x) => x), delete: jest.fn() },
            officialVote: { find: jest.fn() },
            groupVote: { find: jest.fn() },
            law: { find: jest.fn(), findOne: jest.fn() },
        };
        service = new CandidatePositionsService(repos.candidate, repos.position, repos.officialVote, repos.groupVote, repos.law);
    });

    it('resolves one sourced position per visible candidate for a law', async () => {
        repos.position.find.mockResolvedValue([
            { candidate: { id: 'c-declared' }, position: 'POUR', sourceType: 'DECLARATION', sourceUrl: 'https://x.fr', sourceDate: '2026-10-01' },
        ]);
        repos.officialVote.find.mockResolvedValue([{ deputy: { id: 'dep-1' }, choice: 'AGAINST', scrutinId: 'VT1' }]);
        repos.groupVote.find.mockResolvedValue([
            { organeRef: 'PO1', position: 'FOR', label: 'Groupe 1' },
            { organeRef: 'PO2', position: 'AGAINST', label: 'Groupe 2' },
        ]);

        const result = await service.getForLaw('law-1');
        const byId = Object.fromEntries(result.map((r) => [r.candidateId, r]));

        expect(result.map((r) => r.name)).toEqual(['Anne Déclarée', 'Bernard Député', 'Claire Groupe', 'David Inconnu']);
        expect(byId['c-deputy']).toMatchObject({ position: 'CONTRE', sourceType: PositionSourceType.VOTE_PERSONNEL, groupPosition: 'POUR' });
        expect(byId['c-declared']).toMatchObject({ position: 'POUR', sourceType: PositionSourceType.DECLARATION, groupPosition: 'CONTRE' });
        expect(byId['c-group']).toMatchObject({ position: 'CONTRE', sourceType: PositionSourceType.VOTE_GROUPE });
        expect(byId['c-none']).toMatchObject({ position: 'INCONNU' });
        expect(repos.candidate.find.mock.calls[0][0].where.status).toBeDefined();
    });

    it('lists the laws with a known position for a candidate, newest first', async () => {
        repos.candidate.findOne.mockResolvedValue(candidates[0]);
        repos.position.find.mockResolvedValue([]);
        repos.officialVote.find.mockResolvedValue([{ law: { id: 'l-old' }, choice: 'FOR' }]);
        repos.groupVote.find.mockResolvedValue([{ law: { id: 'l-new' }, position: 'AGAINST', label: 'Groupe 1' }]);
        repos.law.find.mockResolvedValue([
            { id: 'l-old', titleOfficial: 'Ancienne', voteDate: '2025-01-10', categories: [{ slug: 'finances', name: 'Finances', icon: '💰' }] },
            { id: 'l-new', titleOfficial: 'Récente', voteDate: '2026-11-01', categories: [] },
        ]);

        const { positions } = await service.getForCandidate('c-deputy');

        expect(positions.map((p) => p.law.titleOfficial)).toEqual(['Récente', 'Ancienne']);
        expect(positions[1]).toMatchObject({ position: 'POUR', sourceType: PositionSourceType.VOTE_PERSONNEL });
        expect(positions[1].law.categories).toEqual([{ slug: 'finances', name: 'Finances', icon: '💰' }]);
        expect(positions[0].sourceType).toBe(PositionSourceType.VOTE_GROUPE);
    });

    it('returns no position for a candidate without any evidence', async () => {
        repos.candidate.findOne.mockResolvedValue(candidates[3]);
        repos.position.find.mockResolvedValue([]);
        await expect(service.getForCandidate('c-none')).resolves.toEqual({ candidateId: 'c-none', positions: [] });
        expect(repos.law.find).not.toHaveBeenCalled();
    });

    it('rejects hidden or unknown candidates', async () => {
        repos.candidate.findOne.mockResolvedValue(null);
        await expect(service.getForCandidate('x')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('upserts a declared position, keeping the existing row id', async () => {
        repos.candidate.findOne.mockResolvedValue(candidates[1]);
        repos.law.findOne.mockResolvedValue({ id: 'law-1' });
        repos.position.findOne.mockResolvedValue({ id: 'pos-1' });

        const saved = await service.upsertDeclared({
            candidateId: 'c-declared',
            lawId: 'law-1',
            position: 'NUANCE' as any,
            sourceType: 'PROGRAMME' as any,
            sourceUrl: 'https://x.fr/programme',
            quote: '  ',
            sourceDate: '2026-09-01',
            verifiedBy: ' JJM ',
        });

        expect(saved).toMatchObject({ id: 'pos-1', position: 'NUANCE', quote: null, verifiedBy: 'JJM' });
    });
});
