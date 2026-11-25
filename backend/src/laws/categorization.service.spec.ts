import { CategorizationService } from './categorization.service';
import { CategoriesSeedService } from './seeds/categories-seed.service';
import { Law } from './law.entity';
import { Category } from './category.entity';

const categories: Category[] = new CategoriesSeedService({} as any).seedData.map(
    (c, i) => Object.assign(new Category(), { id: i + 1, ...c }),
);

const law = (overrides: Partial<Law>): Law => Object.assign(new Law(), { id: 'l1', titleOfficial: '', ...overrides });

describe('CategorizationService', () => {
    let lawRepository: any;
    let service: CategorizationService;

    beforeEach(() => {
        const qb = { leftJoin: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), getMany: jest.fn() };
        lawRepository = { save: jest.fn(async (l) => l), createQueryBuilder: jest.fn(() => qb), qb };
        service = new CategorizationService({ find: jest.fn().mockResolvedValue(categories) } as any, lawRepository);
    });

    it('uses the AI summary sections when the title is not enough', () => {
        const result = service.computeCategories(
            law({ titleOfficial: 'Proposition de loi n° 1234', summary: { sections: { Résumé: 'Revalorise le SMIC et les salaires.' }, pro: [], con: [] } }),
            categories,
        );
        expect(result.map((c) => c.slug)).toEqual(['travail']);
    });

    it('falls back to Institutions when nothing matches', () => {
        expect(service.computeCategories(law({ titleOfficial: 'Texte n° 42' }), categories).map((c) => c.slug)).toEqual([
            'institutions',
        ]);
    });

    it('categorizes only laws without category and reports the count', async () => {
        lawRepository.qb.getMany.mockResolvedValue([
            law({ id: 'a', titleOfficial: 'Projet de loi de finances pour 2027' }),
            law({ id: 'b', titleOfficial: 'Proposition de loi sur la police municipale' }),
        ]);

        const result = await service.categorizeUncategorized();

        expect(result).toEqual({ categorized: 2 });
        expect(lawRepository.qb.where).toHaveBeenCalledWith('category.id IS NULL');
        expect(lawRepository.save.mock.calls.map(([l]) => l.categories[0].slug)).toEqual(['finances', 'securite']);
    });

    it('does nothing when every law is already categorized', async () => {
        lawRepository.qb.getMany.mockResolvedValue([]);
        await expect(service.categorizeUncategorized()).resolves.toEqual({ categorized: 0 });
        expect(lawRepository.save).not.toHaveBeenCalled();
    });
});

describe('CategoriesSeedService', () => {
    it('creates missing categories and resyncs keywords of existing ones without touching name, color or icon', async () => {
        const seed = new CategoriesSeedService({} as any).seedData;
        const finances = { id: 1, ...seed[0], keywords: 'budget,état,loi', color: '#000000' };
        const repo = {
            find: jest.fn().mockResolvedValue([finances]),
            create: jest.fn((c) => c),
            save: jest.fn(),
            update: jest.fn(),
        };

        await new CategoriesSeedService(repo as any).onModuleInit();

        expect(repo.update).toHaveBeenCalledWith(1, { keywords: seed[0].keywords });
        expect(repo.save).toHaveBeenCalledTimes(seed.length - 1);
    });
});
