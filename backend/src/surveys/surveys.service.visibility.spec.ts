import { In } from 'typeorm';
import { SurveysService } from './surveys.service';
import { CandidateStatus, VISIBLE_CANDIDATE_STATUSES } from './candidate.entity';

describe('SurveysService — candidate visibility', () => {
    const candidate = {
        id: 'c1',
        name: 'Jeanne Dupont',
        party: 'Parti A',
        status: CandidateStatus.OFFICIEL,
        officialSiteUrl: 'https://campagne.example.fr',
        officialProgramUrl: 'https://campagne.example.fr/programme.pdf',
        programStatus: 'PUBLIE',
        programPublishedAt: '2027-02-14',
        linksCheckedAt: new Date('2027-02-15'),
    };
    let candidateRepository: any;
    let service: SurveysService;

    beforeEach(() => {
        candidateRepository = { find: jest.fn().mockResolvedValue([candidate]), findOne: jest.fn().mockResolvedValue(null) };
        const counter = { count: jest.fn().mockResolvedValue(0) };
        service = new SurveysService(
            candidateRepository,
            counter as any,
            {} as any,
            { findOne: jest.fn().mockResolvedValue({ id: 'cit' }) } as any,
            {} as any,
            counter as any,
        );
    });

    it('never lists MASQUE candidates', () => {
        expect(VISIBLE_CANDIDATE_STATUSES).not.toContain(CandidateStatus.MASQUE);
        expect(VISIBLE_CANDIDATE_STATUSES).toContain(CandidateStatus.RETIRE);
    });

    it('filters the public candidate list by visible statuses', async () => {
        await service.getCandidates();
        expect(candidateRepository.find).toHaveBeenCalledWith({ where: { status: In(VISIBLE_CANDIDATE_STATUSES) } });
    });

    it('exposes the official links in the results', async () => {
        const { results } = await service.getResults();
        expect(results[0]).toMatchObject({
            status: 'OFFICIEL',
            officialSiteUrl: 'https://campagne.example.fr',
            officialProgramUrl: 'https://campagne.example.fr/programme.pdf',
            programStatus: 'PUBLIE',
            programPublishedAt: '2027-02-14',
        });
        expect(candidateRepository.find.mock.calls[0][0].where).toEqual({ status: In(VISIBLE_CANDIDATE_STATUSES) });
    });

    it('refuses votes for a hidden candidate', async () => {
        await expect(service.vote('user-1', 'c1')).rejects.toThrow('introuvable');
        expect(candidateRepository.findOne.mock.calls[0][0].where).toMatchObject({ status: In(VISIBLE_CANDIDATE_STATUSES) });
    });
});
