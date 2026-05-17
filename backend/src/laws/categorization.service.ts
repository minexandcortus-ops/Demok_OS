import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './category.entity';
import { Law } from './law.entity';

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

        // Si déjà catégorisée et pas de force update, skip
        if (!force && law.categories && law.categories.length > 0) {
            this.logger.log(`Law ${lawId} already categorized`);
            return;
        }

        // Récupérer toutes les catégories
        const allCategories = await this.categoryRepository.find();

        // Préparer le texte à analyser
        const textToAnalyze = this.prepareTextForAnalysis(law);

        // Détection par mots-clés
        const detectedCategories = this.detectByKeywords(textToAnalyze, allCategories);

        // Assigner les catégories (max 3)
        const selectedCategories = detectedCategories.slice(0, 3);

        if (selectedCategories.length === 0) {
            // Fallback: assigner "Institutions" par défaut
            const defaultCategory = allCategories.find(c => c.slug === 'institutions');
            if (defaultCategory) {
                selectedCategories.push(defaultCategory);
            }
        }

        law.categories = selectedCategories;
        await this.lawRepository.save(law);

        this.logger.log(
            `✅ Law "${law.titleOfficial}" categorized as: ${selectedCategories.map(c => c.name).join(', ')}`
        );
    }

    /**
     * Prépare le texte de la loi pour l'analyse
     */
    private prepareTextForAnalysis(law: Law): string {
        const parts: string[] = [];

        if (law.titleOfficial) parts.push(law.titleOfficial);
        if (law.titleVulgarized) parts.push(law.titleVulgarized);
        if (law.summary?.sections) {
            // Add all section values for analysis
            Object.values(law.summary.sections).forEach(sectionText => {
                parts.push(sectionText);
            });
        }

        return parts.join(' ').toLowerCase();
    }

    /**
     * Détecte les catégories par correspondance de mots-clés
     */
    private detectByKeywords(text: string, categories: Category[]): Category[] {
        const scores: Array<{ category: Category; score: number }> = [];

        for (const category of categories) {
            const keywords = category.keywords.split(',').map(k => k.trim().toLowerCase());
            let matchCount = 0;

            for (const keyword of keywords) {
                if (text.includes(keyword)) {
                    matchCount++;
                }
            }

            // Score basé simplement sur le nombre de mots-clés trouvés
            // On ne divise plus par la longueur de la liste pour ne pas pénaliser les listes exhaustives
            const score = matchCount;

            if (score > 0) {
                // Au moins un mot-clé trouvé
                scores.push({ category, score });
            }
        }

        // Trier par score décroissant
        scores.sort((a, b) => b.score - a.score);

        return scores.map(s => s.category);
    }

    /**
     * Recatégorise toutes les lois existantes (migration)
     */
    async categorizeAllLaws(): Promise<void> {
        this.logger.log('Starting to categorize all existing laws...');

        const laws = await this.lawRepository.find({ relations: ['categories'] });
        let categorizedCount = 0;

        for (const law of laws) {
            // Force update pour tout le monde
            await this.categorize(law.id, true);
            categorizedCount++;
        }

        this.logger.log(`✅  Categorization complete: ${categorizedCount} laws categorized`);
    }
}
