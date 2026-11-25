import axios from 'axios';
import { CandidatesSyncService } from './candidates-sync.service';
import { CandidateStatus } from './candidate.entity';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const markdown = (title: string, party: string, body = 'Candidat déclaré.') =>
    `---\ntitle: ${title}\nparty: ${party}\nphoto: /photos/x.jpg\ndescription: Profil\n---\n${body}`;

describe('CandidatesSyncService', () => {
    let saved: any[];
    let repo: any;
    let service: CandidatesSyncService;

    const mockSource = (files: Record<string, string>) => {
        mockedAxios.get.mockImplementation(async (url: string) => {
            if (url.includes('api.github.com')) {
                return { data: Object.keys(files).map((name) => ({ name, download_url: `https://raw/${name}` })) };
            }
            const name = url.replace('https://raw/', '');
            return { data: files[name] };
        });
    };

    beforeEach(() => {
        saved = [];
        repo = {
            find: jest.fn().mockResolvedValue([]),
            create: jest.fn((c) => c),
            save: jest.fn(async (c) => {
                saved.push(c);
                return c;
            }),
            update: jest.fn(),
            delete: jest.fn(),
            count: jest.fn(async () => saved.length),
        };
        service = new CandidatesSyncService(repo);
    });

    it('creates new candidates as DECLARE with the third-party summary link', async () => {
        mockSource({ 'jeanne-dupont.md': markdown('Jeanne Dupont', 'Parti A') });

        await service.syncCandidates();

        expect(saved).toHaveLength(1);
        expect(saved[0]).toMatchObject({
            name: 'Jeanne Dupont',
            status: CandidateStatus.DECLARE,
            programUrl: 'https://www.candidatspresidentielles2027.fr/candidats/jeanne-dupont',
        });
        expect(saved[0].officialProgramUrl).toBeUndefined();
    });

    it('creates historically excluded names as MASQUE instead of deleting them', async () => {
        mockSource({ 'jordan-bardella.md': markdown('Jordan Bardella', 'RN') });

        await service.syncCandidates();

        expect(saved[0].status).toBe(CandidateStatus.MASQUE);
        expect(repo.delete).not.toHaveBeenCalled();
    });

    it('never recreates nor deletes an existing (even masked) candidate', async () => {
        repo.find.mockResolvedValue([{ id: 'c1', name: 'Jordan Bardella', status: CandidateStatus.MASQUE, photoUrl: null }]);
        mockSource({ 'jordan-bardella.md': markdown('Jordan Bardella', 'RN') });

        await service.syncCandidates();

        expect(saved).toHaveLength(0);
        expect(repo.delete).not.toHaveBeenCalled();
    });

    it('skips profiles stating they are not candidates', async () => {
        mockSource({ 'x.md': markdown('Paul Martin', 'Parti B', "Il n'est pas candidat en 2027.") });
        await service.syncCandidates();
        expect(saved).toHaveLength(0);
    });

    it('matches legacy hidden names on the normalised full name only', () => {
        expect(service.isLegacyHidden('Jordan BARDELLA')).toBe(true);
        expect(service.isLegacyHidden('Marie Bardella-Durand')).toBe(false);
    });
});
