import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './category.entity';
import { Law } from './law.entity';
import { scoreCategories, selectCategories } from './keyword-matcher';

export const DEFAULT_CATEGORY_SLUG = 'institutions';

@Injectable()
export class CategorizationService {
    private readonly logger = new Logger(CategorizationService.name);

    constructor(
        @InjectRepository(Category)
        private readonly categoryRepository: Repository<Category>,
        @InjectRepository(Law)
        private readonly lawRepository: Repository<Law>,
    ) { }

    /**
     * Calcule les catégories d'une loi (sans persister).
     * Repli sur « Institutions » si aucun mot-clé ne correspond.
     */
    computeCategories(law: Law, allCategories: Category[]): Category[] {
        const title = [law.titleOfficial, law.titleVulgarized].filter(Boolean).join(' ');
        const body = law.summary?.sections ? Object.values(law.summary.sections).join(' ') : '';
        const selected = selectCategories(scoreCategories(title, body, allCategories));

        if (!selected.length) {
            const fallback = allCategories.find((c) => c.slug === DEFAULT_CATEGORY_SLUG);
            return fallback ? [fallback] : [];
        }
        return selected;
    }

    /**
     * Catégorise automatiquement une loi en fonction de son contenu
     */
    async categorize(lawId: string, force: boolean = false): Promise<void> {
        const law = await this.lawRepository.findOne({
            where: { id: lawId },
            relations: ['categories'],
        });

        if (!law) {
            this.logger.warn(`Law ${lawId} not found`);
            return;
        }

        if (!force && law.categories && law.categories.length > 0) {
            this.logger.log(`Law ${lawId} already categorized`);
            return;
        }

        const allCategories = await this.categoryRepository.find();
        law.categories = this.computeCategories(law, allCategories);
        await this.lawRepository.save(law);

        this.logger.log(`✅ Law "${law.titleOfficial}" categorized as: ${law.categories.map((c) => c.name).join(', ')}`);
    }

    /**
     * Catégorise les lois qui n'ont encore aucune catégorie (appelé par le cron quotidien,
     * après la génération des résumés IA pour bénéficier de leur texte).
     */
    async categorizeUncategorized(): Promise<{ categorized: number }> {
        const uncategorized = await this.lawRepository
            .createQueryBuilder('law')
            .leftJoin('law.categories', 'category')
            .where('category.id IS NULL')
            .getMany();

        if (!uncategorized.length) return { categorized: 0 };

        const allCategories = await this.categoryRepository.find();
        for (const law of uncategorized) {
            law.categories = this.computeCategories(law, allCategories);
            await this.lawRepository.save(law);
        }

        this.logger.log(`✅ ${uncategorized.length} loi(s) catégorisée(s)`);
        return { categorized: uncategorized.length };
    }

    /**
     * Recatégorise toutes les lois existantes (migration)
     */
    async categorizeAllLaws(): Promise<void> {
        this.logger.log('Starting to categorize all existing laws...');

        const laws = await this.lawRepository.find({ relations: ['categories'] });
        const allCategories = await this.categoryRepository.find();

        for (const law of laws) {
            law.categories = this.computeCategories(law, allCategories);
            await this.lawRepository.save(law);
        }

        this.logger.log(`✅  Categorization complete: ${laws.length} laws categorized`);
    }
}
