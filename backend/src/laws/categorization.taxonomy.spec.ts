import { CategorizationService } from './categorization.service';
import { CategoriesSeedService } from './seeds/categories-seed.service';
import { Category } from './category.entity';
import { Law } from './law.entity';
import { Territory } from './taxonomy';

const categories: Category[] = new CategoriesSeedService({} as any).seedData.map((c, i) =>
    Object.assign(new Category(), { id: i + 1, ...c }),
);
const law = (overrides: Partial<Law> = {}) =>
    Object.assign(new Law(), { id: 'l1', titleOfficial: 'Projet de loi relatif à Mayotte', categories: [], territories: [], ...overrides });

describe('CategorizationService — taxonomy', () => {
    let lawRepository: any;
    let service: CategorizationService;

    beforeEach(() => {
        lawRepository = { findOne: jest.fn(), save: jest.fn(async (l) => l), find: jest.fn() };
        service = new CategorizationService({ find: jest.fn().mockResolvedValue(categories) } as any, lawRepository);
    });

    it('applies a valid AI classification (themes + territories)', () => {
        const l = law();
        const applied = service.applyAiClassification(
            l,
            { theme_principal: 'institutions', themes_secondaires: ['amenagement'], territoires: ['MAYOTTE'], confiance: 0.9 },
            categories,
        );
        expect(applied).toBe(true);
        expect(l.categories.map((c) => c.slug)).toEqual(['institutions', 'amenagement']);
        expect(l.territories.sort()).toEqual([Territory.MAYOTTE, Territory.OUTRE_MER].sort());
        expect(l.classificationSource).toBe('AI');
    });

    it('leaves the law untouched when the AI output is invalid (keyword pass takes over later)', () => {
        const previous = [categories[0]];
        const l = law({ categories: previous });
        expect(service.applyAiClassification(l, { theme_principal: 'inconnu' }, categories)).toBe(false);
        expect(l.categories).toBe(previous);
        expect(l.classificationSource).toBeUndefined();
    });

    it('never overrides a locked (manual) classification', () => {
        const l = law({ categoriesLocked: true, territories: [Territory.CORSE] });
        expect(service.applyAiClassification(l, { theme_principal: 'finances', territoires: ['NATIONAL'] }, categories)).toBe(false);
        service.applyKeywordClassification(l, categories);
        expect(l.territories).toEqual([Territory.CORSE]);
    });

    it('detects territories in the keyword fallback', () => {
        const l = law();
        service.applyKeywordClassification(l, categories);
        expect(l.territories).toContain(Territory.MAYOTTE);
        expect(l.classificationSource).toBe('KEYWORDS');
    });

    it('stores a manual classification, locked by default, and validates themes', async () => {
        lawRepository.findOne.mockResolvedValue(law());
        const saved = await service.setManualClassification('l1', ['justice', 'justice', 'securite'], ['corse']);
        expect(saved.categories.map((c) => c.slug)).toEqual(['justice', 'securite']);
        expect(saved.territories).toEqual([Territory.CORSE]);
        expect(saved).toMatchObject({ categoriesLocked: true, classificationSource: 'MANUAL' });

        await expect(service.setManualClassification('l1', ['inconnu'], [])).rejects.toThrow('thème');
    });

    it('recategorize-all spares AI, manual and locked classifications', async () => {
        lawRepository.find.mockResolvedValue([
            law({ id: 'a', classificationSource: 'AI' }),
            law({ id: 'b', classificationSource: 'MANUAL' }),
            law({ id: 'c', categoriesLocked: true }),
            law({ id: 'd', classificationSource: null }),
        ]);
        await service.categorizeAllLaws();
        expect(lawRepository.save.mock.calls.map(([l]) => l.id)).toEqual(['d']);
    });
});
