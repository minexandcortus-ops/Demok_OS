import {
    countMatches,
    normalizeText,
    parseKeywords,
    scoreCategories,
    selectCategories,
    STOP_WORDS,
} from './keyword-matcher';
import { CategoriesSeedService } from './seeds/categories-seed.service';

const seed = new CategoriesSeedService({} as any).seedData.map((c) => ({ ...c }));
const categorize = (title: string, body = '') => selectCategories(scoreCategories(title, body, seed)).map((c) => c.slug);

describe('normalizeText', () => {
    it('lowercases, strips accents and punctuation, pads with spaces', () => {
        expect(normalizeText("Sécurité  de l'État !")).toBe(' securite de l etat ');
    });
});

describe('parseKeywords', () => {
    it('drops generic single stop-words but keeps meaningful phrases', () => {
        expect(parseKeywords('loi, Loi de finances, publique, État, budget')).toEqual(['loi de finances', 'budget']);
    });

    it('removes duplicates after normalisation', () => {
        expect(parseKeywords('Énergie,energie,ÉNERGIE')).toEqual(['energie']);
    });
});

describe('countMatches', () => {
    it('matches whole words only', () => {
        expect(countMatches(normalizeText('un nouveau barrage'), 'eau')).toBe(0);
        expect(countMatches(normalizeText("la qualité de l'eau potable"), 'eau')).toBe(1);
        expect(countMatches(normalizeText('une affaire'), 'air')).toBe(0);
    });

    it('matches multi-word phrases', () => {
        expect(countMatches(normalizeText('la Sécurité sociale pour 2026'), 'securite sociale')).toBe(1);
    });
});

describe('seed keywords', () => {
    it('contain no isolated stop-word (they would match almost every law)', () => {
        for (const category of seed) {
            for (const raw of category.keywords.split(',')) {
                expect({ slug: category.slug, keyword: raw, stop: STOP_WORDS.has(normalizeText(raw).trim()) }).toEqual({
                    slug: category.slug,
                    keyword: raw,
                    stop: false,
                });
            }
        }
    });
});

describe('categorization of real law titles', () => {
    it.each([
        ['Projet de loi de finances pour 2026', 'finances'],
        ['Projet de loi de financement de la sécurité sociale pour 2026', 'social_sante'],
        ["Proposition de loi relative au droit à l'aide à mourir", 'societe_vie'],
        ['Projet de loi de simplification de la vie économique', 'economie'],
        ['Proposition de loi visant à protéger les mineurs sur les réseaux sociaux', 'numerique'],
        ["Projet de loi pour contrôler l'immigration et améliorer l'intégration", 'immigration'],
        ['Projet de loi relatif à la programmation militaire pour les années 2024 à 2030', 'securite'],
        ['Proposition de loi visant à sortir la France du piège du narcotrafic', 'securite'],
        ["Projet de loi d'orientation pour la souveraineté alimentaire et agricole", 'agriculture'],
        ['Proposition de loi visant à lutter contre la pénurie de médecins', 'social_sante'],
        ["Projet de loi autorisant la ratification du traité d'amitié entre la France et l'Italie", 'international'],
        ['Projet de loi constitutionnelle portant réforme du Conseil supérieur de la magistrature', 'institutions'],
        ['Proposition de loi visant à faciliter la transformation des bureaux en logements', 'amenagement'],
    ])('"%s" → %s (main category)', (title, expected) => {
        expect(categorize(title)[0]).toBe(expected);
    });

    it('no longer puts every law in Finances because of the word "loi"', () => {
        expect(categorize('Proposition de loi visant à renforcer la police municipale')).not.toContain('finances');
    });

    it('keeps at most 3 categories and drops weak secondary ones', () => {
        const title = 'Projet de loi de finances : budget, impôts, TVA et dette publique';
        const body = 'Une mention isolée des écoles.';
        const result = categorize(title, body);
        expect(result[0]).toBe('finances');
        expect(result).not.toContain('education');
        expect(result.length).toBeLessThanOrEqual(3);
    });

    it('returns nothing when no keyword matches (the service falls back to Institutions)', () => {
        expect(categorize('Texte sans rapport identifiable')).toEqual([]);
    });
});
