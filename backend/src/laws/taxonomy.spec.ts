import {
    buildClassificationInstructions,
    detectTerritories,
    expandTerritoryFilter,
    normalizeTerritories,
    OUTRE_MER_TERRITORIES,
    parseClassification,
    Territory,
} from './taxonomy';
import { CategoriesSeedService } from './seeds/categories-seed.service';

const seed = new CategoriesSeedService({} as any).seedData;
const slugs = seed.map((c) => c.slug);

describe('taxonomy — themes', () => {
    it('exposes the 16 themes of the closed taxonomy', () => {
        expect(slugs).toHaveLength(16);
        expect(slugs).toEqual(expect.arrayContaining(['economie', 'societe_vie', 'numerique', 'immigration', 'finances', 'securite']));
        expect(new Set(slugs).size).toBe(16);
    });
});

describe('parseClassification', () => {
    it('keeps the main theme first, at most 2 secondary ones, and ignores unknown slugs', () => {
        const parsed = parseClassification(
            {
                theme_principal: 'Finances',
                themes_secondaires: ['social_sante', 'inventé', 'finances', 'travail', 'economie'],
                territoires: ['national'],
                confiance: 0.82,
            },
            slugs,
        );
        expect(parsed).toEqual({ themes: ['finances', 'social_sante', 'travail'], territories: [Territory.NATIONAL], confidence: 0.82 });
    });

    it('adds OUTRE_MER for an overseas territory and drops NATIONAL when a territory is specific', () => {
        const parsed = parseClassification({ theme_principal: 'institutions', territoires: ['NATIONAL', 'nouvelle_caledonie'] }, slugs);
        expect(parsed.territories.sort()).toEqual([Territory.NOUVELLE_CALEDONIE, Territory.OUTRE_MER].sort());
    });

    it('defaults to NATIONAL, clamps confidence and returns null without a valid theme', () => {
        expect(parseClassification({ theme_principal: 'justice', confiance: 7 }, slugs)).toMatchObject({
            territories: [Territory.NATIONAL],
            confidence: 1,
        });
        expect(parseClassification({ theme_principal: 'astrologie' }, slugs)).toBeNull();
        expect(parseClassification(null, slugs)).toBeNull();
        expect(parseClassification('finances', slugs)).toBeNull();
    });
});

describe('territories', () => {
    it.each([
        ['Projet de loi constitutionnelle relatif à la Nouvelle-Calédonie', [Territory.NOUVELLE_CALEDONIE, Territory.OUTRE_MER]],
        ['Projet de loi de programmation pour la refondation de Mayotte', [Territory.MAYOTTE, Territory.OUTRE_MER]],
        ["Proposition de loi visant à lutter contre la vie chère dans les outre-mer", [Territory.OUTRE_MER]],
        ['Projet de loi relatif à l\'autonomie de la Corse', [Territory.CORSE]],
        ["Projet de loi portant diverses dispositions d'adaptation au droit de l'Union européenne", [Territory.UE]],
        ["Projet de loi autorisant la ratification du traité entre la France et l'Italie", [Territory.INTERNATIONAL]],
        ['Projet de loi de finances pour 2027', [Territory.NATIONAL]],
    ])('"%s" → %j', (title, expected) => {
        expect(detectTerritories(title).sort()).toEqual([...expected].sort());
    });

    it('does not mistake "Saint-Martin-d\'Hères" style words or "réunion" meetings too eagerly', () => {
        expect(detectTerritories('Proposition de loi sur la liberté de réunion')).toEqual([Territory.NATIONAL]);
    });

    it('normalizeTerritories ignores unknown codes', () => {
        expect(normalizeTerritories(['PLANETE_MARS', 'corse'])).toEqual([Territory.CORSE]);
    });

    it('expands the OUTRE_MER filter to every overseas territory and rejects unknown filters', () => {
        expect(expandTerritoryFilter('outre_mer')).toEqual([Territory.OUTRE_MER, ...OUTRE_MER_TERRITORIES]);
        expect(expandTerritoryFilter('CORSE')).toEqual([Territory.CORSE]);
        expect(expandTerritoryFilter('nowhere')).toEqual([]);
    });
});

describe('buildClassificationInstructions', () => {
    it('lists every theme slug and territory code for the model', () => {
        const prompt = buildClassificationInstructions(seed);
        for (const slug of slugs) expect(prompt).toContain(slug);
        for (const code of Object.values(Territory)) expect(prompt).toContain(code);
        expect(prompt).toContain('"classification"');
    });
});
