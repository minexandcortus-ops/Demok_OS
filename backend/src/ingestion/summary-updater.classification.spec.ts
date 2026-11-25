import { SummaryUpdaterService } from './summary-updater.service';
import { CategorizationService } from '../laws/categorization.service';
import { CategoriesSeedService } from '../laws/seeds/categories-seed.service';
import { Category } from '../laws/category.entity';
import { Law } from '../laws/law.entity';
import { Territory } from '../laws/taxonomy';
import { AiService } from '../ai/ai.service';

const categories: Category[] = new CategoriesSeedService({} as any).seedData.map((c, i) =>
    Object.assign(new Category(), { id: i + 1, ...c }),
);

describe('SummaryUpdaterService — classification in the summary call', () => {
    const originalFetch = global.fetch;
    let lawRepository: any;
    let service: SummaryUpdaterService;
    let requestBody: any;

    const mockMistral = (content: object) => {
        global.fetch = jest.fn(async (_url, init: any) => {
            requestBody = JSON.parse(init.body);
            return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(content) } }] }) } as any;
        });
    };

    beforeEach(() => {
        lawRepository = { save: jest.fn(async (l) => l) };
        const categoryRepository = { find: jest.fn().mockResolvedValue(categories) };
        const config = { get: jest.fn((key: string, def?: string) => (key === 'MISTRAL_API_KEY' ? 'test-key' : def)) };
        const categorization = new CategorizationService(categoryRepository as any, lawRepository);
        service = new SummaryUpdaterService(lawRepository, config as any, categoryRepository as any, categorization, new AiService(config as any));
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    const law = () =>
        Object.assign(new Law(), { id: 'l1', externalId: 'X', titleOfficial: 'Projet de loi relatif à la Nouvelle-Calédonie', rawText: 'Texte' });

    it('asks the model for a classification restricted to the taxonomy', async () => {
        mockMistral({ classique: { titre: 'Un titre vulgarisé', resume: 'Résumé.' } });
        await service.updateSummary(law());

        const systemPrompt: string = requestBody.messages[0].content;
        expect(systemPrompt).toContain('"classification"');
        expect(systemPrompt).toContain('societe_vie');
        expect(systemPrompt).toContain('NOUVELLE_CALEDONIE');
    });

    it('stores the AI themes and territories with the summary', async () => {
        mockMistral({
            classique: { titre: 'Un titre vulgarisé', resume: 'Résumé.' },
            classification: { theme_principal: 'institutions', territoires: ['NOUVELLE_CALEDONIE'], confiance: 0.9 },
        });
        const l = law();
        await service.updateSummary(l);

        const saved = lawRepository.save.mock.calls.at(-1)[0];
        expect(saved.categories.map((c: Category) => c.slug)).toEqual(['institutions']);
        expect(saved.territories.sort()).toEqual([Territory.NOUVELLE_CALEDONIE, Territory.OUTRE_MER].sort());
        expect(saved.classificationSource).toBe('AI');
        expect(saved.summary.sections['Résumé']).toBe('Résumé.');
    });

    it('keeps the summary when the classification is missing or invalid', async () => {
        mockMistral({ classique: { titre: 'Un titre vulgarisé', resume: 'Résumé.' }, classification: { theme_principal: '???' } });
        const l = law();
        await service.updateSummary(l);

        const saved = lawRepository.save.mock.calls.at(-1)[0];
        expect(saved.summary.sections['Résumé']).toBe('Résumé.');
        expect(saved.classificationSource).toBeUndefined();
    });
});
