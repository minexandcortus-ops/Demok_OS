import { Controller, Get, Post, Param } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './category.entity';
import { CategorizationService } from './categorization.service';

@Controller('categories')
export class CategoriesController {
    /**
     * Contrôleur gérant les catégories (thématiques) des lois.
     * Permet la récupération de la liste et le déclenchement de la classification via IA.
     */
    constructor(
        @InjectRepository(Category)
        private readonly categoryRepository: Repository<Category>,
        private readonly categorizationService: CategorizationService,
    ) { }

    @Get()
    async getAllCategories() {
        return this.categoryRepository.find();
    }

    @Post('recategorize-all')
    async recategorizeAllLaws() {
        await this.categorizationService.categorizeAllLaws();
        return { message: 'All laws have been recategorized' };
    }

    @Post('recategorize/:lawId')
    async recategorizeLaw(@Param('lawId') lawId: string) {
        await this.categorizationService.categorize(lawId);
        return { message: `Law ${lawId} has been recategorized` };
    }
}
