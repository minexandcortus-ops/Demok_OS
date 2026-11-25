import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './category.entity';
import { Law } from './law.entity';
import { scoreCategories, selectCategories } from './keyword-matcher';
import { detectTerritories, normalizeTerritories, parseClassification } from './taxonomy';

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

    /** Texte servant à la détection (titres + sections du résumé). */
    private textOf(law: Law): string {
        const sections = law.summary?.sections ? Object.values(law.summary.sections).join(' ') : '';
        return [law.titleOfficial, law.titleVulgarized, sections].filter(Boolean).join(' ');
    }

    /** Applique la classification par mots-clés (thèmes + territoires) à une loi non verrouillée. */
    applyKeywordClassification(law: Law, allCategories: Category[]): void {
        if (law.categoriesLocked) return;
        law.categories = this.computeCategories(law, allCategories);
        law.territories = detectTerritories(this.textOf(law));
        law.classificationSource = 'KEYWORDS';
    }

    /**
     * Applique la classification proposée par l'IA (même appel que la synthèse).
     * Les slugs et codes inconnus sont ignorés. Sans thème valide, la loi n'est pas modifiée :
     * l'étape de catégorisation par mots-clés du cron (exécutée juste après) prend le relais.
     * Retourne true si la classification IA a été retenue.
     */
    applyAiClassification(law: Law, raw: unknown, allCategories: Category[]): boolean {
        if (law.categoriesLocked) return false;
        const parsed = parseClassification(raw, allCategories.map((c) => c.slug));
        if (!parsed) return false;
        const bySlug = new Map(allCategories.map((c) => [c.slug, c]));
        law.categories = parsed.themes.map((slug) => bySlug.get(slug)).filter(Boolean);
        law.territories = parsed.territories;
        law.classificationSource = 'AI';
        return true;
    }

    /** Classification manuelle (admin), verrouillée par défaut. */
    async setManualClassification(lawId: string, categorySlugs: string[], territories: string[], locked = true): Promise<Law> {
        const law = await this.lawRepository.findOne({ where: { id: lawId }, relations: ['categories'] });
        if (!law) throw new Error('Loi introuvable');
        const allCategories = await this.categoryRepository.find();
        const bySlug = new Map(allCategories.map((c) => [c.slug, c]));
        const categories = [...new Set(categorySlugs)].map((s) => bySlug.get(s)).filter(Boolean);
        if (!categories.length) throw new Error('Au moins un thème valide est requis');
        law.categories = categories.slice(0, 3);
        law.territories = normalizeTerritories(territories);
        law.categoriesLocked = locked;
        law.classificationSource = 'MANUAL';
        return this.lawRepository.save(law);
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
        this.applyKeywordClassification(law, allCategories);
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
            .andWhere('law.categoriesLocked = false')
            .getMany();

        if (!uncategorized.length) return { categorized: 0 };

        const allCategories = await this.categoryRepository.find();
        for (const law of uncategorized) {
            this.applyKeywordClassification(law, allCategories);
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
            // Ne remplace ni une classification manuelle ni celle de l'IA
            if (law.categoriesLocked || law.classificationSource === 'AI' || law.classificationSource === 'MANUAL') continue;
            this.applyKeywordClassification(law, allCategories);
            await this.lawRepository.save(law);
        }

        this.logger.log(`✅  Categorization complete: ${laws.length} laws categorized`);
    }
}
