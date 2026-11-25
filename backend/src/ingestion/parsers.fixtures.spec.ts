import { readFileSync } from 'fs';
import { join } from 'path';
import { of } from 'rxjs';
import { IngestionHtmlAgendaService } from './ingestion-html-agenda.service';
import { AmendementIngestionService } from './amendement-ingestion.service';
import { DynScraperService } from './dyn-scraper.service';
import { DiffDetectorService } from './diff-detector.service';
import { AmendementStatut } from '../laws/amendement.entity';
import { VoteChoice } from '../votes/vote.types';

const fixture = (name: string) => readFileSync(join(__dirname, '__fixtures__', name), 'utf8');

describe('IngestionHtmlAgendaService.parseAgendaHtml (ordre du jour AN)', () => {
    const service = new IngestionHtmlAgendaService({} as any, {} as any, {} as any, {} as any, {} as any);
    const entries = service.parseAgendaHtml(fixture('agenda-an.html'));

    it('associates each law with the date block it appears in', () => {
        expect(entries.map((e) => [e.date, e.externalId])).toEqual([
            ['2026-03-30', 'DLR5L17N53456'],
            ['2026-03-30', 'accelerer_prevention_risques'],
            ['2026-05-01', 'DLR5L17N60001'],
            ['2026-08-18', 'DLR5L17N60002'],
        ]);
    });

    it('decodes HTML entities and collapses whitespace in titles', () => {
        expect(entries[1].title).toBe("Proposition de loi visant à l'accélération & la prévention des risques");
        expect(entries[2].title).toBe('Proposition de loi sur la fin de vie');
    });

    it('skips motions de censure and blocks without a readable date', () => {
        expect(entries.some((e) => e.externalId.includes('motion_censure'))).toBe(false);
        expect(entries.some((e) => e.externalId === 'DLR5L17N69999')).toBe(false);
    });
});

describe('IngestionHtmlAgendaService.parseFrenchDate', () => {
    const service = new IngestionHtmlAgendaService({} as any, {} as any, {} as any, {} as any, {} as any);

    it.each([
        ['Lundi 30 mars 2026', '2026-03-30'],
        ['Vendredi 1er mai 2026', '2026-05-01'],
        ['Mardi 18 août 2026', '2026-08-18'],
        ['jeudi 5 fevrier 2026', '2026-02-05'],
        ['Mercredi 2 decembre 2026', '2026-12-02'],
    ])('%s → %s', (raw, iso) => {
        expect(service.parseFrenchDate(raw)).toBe(iso);
    });

    it.each(['Lundi 31 février 2026', '32 mars 2026', 'Lundi mars 2026', 'Samedi 3 brumaire 2026'])('rejects "%s"', (raw) => {
        expect(service.parseFrenchDate(raw)).toBeNull();
    });
});

describe('AmendementIngestionService — CSV and XML helpers', () => {
    const service = new AmendementIngestionService({} as any, { get: () => undefined } as any, {} as any, {} as any);
    const rows = service.parseCsv(fixture('amendements-an.csv'));

    it('parses quoted fields with commas, escaped quotes and CRLF line endings', () => {
        expect(rows[0]).toMatchObject({
            Numéro: '1',
            Auteur: 'M. Jean Dupont',
            'Exposé sommaire': 'Cet article est inutile, et coûteux.',
        });
        expect(rows[1].Auteur).toBe('Mme Claire "Kiki" Martin');
    });

    it('keeps line breaks inside quoted fields (multi-line dispositif)', () => {
        expect(rows[1].Dispositif).toBe("Rédiger ainsi l'alinéa 3 :\n« Le présent article entre en vigueur en 2027. »");
        expect(rows[1].Lien).toMatch(/\/2\.xml$/);
    });

    it('drops incomplete rows and keeps empty values', () => {
        expect(rows.map((r) => r.Numéro)).toEqual(['1', '2', '4']);
        expect(rows[2].Dispositif).toBe('');
    });

    it.each([
        ['Adopté', AmendementStatut.ADOPTE],
        ['Rejeté', AmendementStatut.REJETE],
        ['Retiré', AmendementStatut.RETIRE],
        ['Tombé', AmendementStatut.TOMBE],
        ['Non soutenu', AmendementStatut.NON_DEFENDU],
        ['Non défendu', AmendementStatut.NON_DEFENDU],
        [null, AmendementStatut.EN_DISCUSSION],
        ['En discussion', AmendementStatut.EN_DISCUSSION],
    ])('maps the sort "%s"', (sort, statut) => {
        expect((service as any).parseStatut(sort)).toBe(statut);
    });

    it('extracts identifiers', () => {
        expect(service.extractDossierId('AN_DLR5L17N52985')).toBe('52985');
        expect((service as any).extractAmendementId('https://www.assemblee-nationale.fr/dyn/17/amendements/1234/AN/42.xml')).toBe('AN_42');
        expect((service as any).extractXmlUrl('not-a-url')).toBeNull();
    });

    it('extracts and decodes (double-encoded) XML fields', () => {
        const xml = '<amendement><dispositif>&amp;lt;p&amp;gt;Supprimer l&amp;#039;article&amp;lt;/p&amp;gt;</dispositif></amendement>';
        expect((service as any).extractXmlField(xml, 'dispositif')).toBe("Supprimer l'article");
        expect((service as any).extractXmlField(xml, 'exposeSommaire')).toBe('');
    });
});

describe('DynScraperService.scrapeScrutinDetails (page HTML de secours)', () => {
    const http = { get: jest.fn(() => of({ data: fixture('scrutin-dyn.html') })) };
    const service = new DynScraperService(http as any);

    it('reads the totals, the date and the dossier', async () => {
        const details = await service.scrapeScrutinDetails('VTANR5L17V1234');
        expect(details).toMatchObject({
            pour: 5,
            contre: 3,
            abstention: 1,
            total: 9,
            adopted: true,
            dateScrutin: '2026-11-18',
            dossierSlug: 'simplification_vie_economique',
        });
    });

    it('reads every group and its deputies by choice', async () => {
        const { groupVotes } = await service.scrapeScrutinDetails('VTANR5L17V1234');
        expect(groupVotes.map((g) => [g.groupOrganId, g.groupName, g.votes.length])).toEqual([
            ['PO845401', 'Rassemblement National', 4],
            ['PO845413', 'La France insoumise - NFP', 3],
        ]);
        expect(groupVotes[1].votes).toEqual([
            { deputyName: 'Émilie Roux', deputyAnRef: 'PA2001', choice: VoteChoice.AGAINST },
            { deputyName: 'Farid Benali', deputyAnRef: 'PA2002', choice: VoteChoice.AGAINST },
            { deputyName: 'Gaëlle Simon', deputyAnRef: 'PA2003', choice: VoteChoice.ABSTAIN },
        ]);
    });

    it('returns null when the page cannot be fetched', async () => {
        const failing = new DynScraperService({ get: jest.fn(() => { throw new Error('503'); }) } as any);
        await expect(failing.scrapeScrutinDetails('X')).resolves.toBeNull();
    });
});

describe('DiffDetectorService', () => {
    const service = new DiffDetectorService();

    it('hashes content deterministically', () => {
        expect(service.computeHash('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
        expect(service.computeHash('')).toBe('');
    });

    it('flags content and navette changes', async () => {
        const existing: any = { contentHash: service.computeHash('v1'), titleOfficial: 'T', navetteStatus: 'premiere_lecture_an' };
        const change = await service.detectChanges(existing, { content: 'v2', titleOfficial: 'T', navetteStatus: 'premiere_lecture_senat' });
        expect(change.hasContentChanged).toBe(true);
        expect(change.changedFields).toContain('navetteStatus');
        expect(change.changedFields).not.toContain('titleOfficial');
    });
});
