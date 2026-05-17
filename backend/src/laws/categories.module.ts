import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from './category.entity';
import { Law } from './law.entity';
import { Amendement } from './amendement.entity';
import { CategorizationService } from './categorization.service';
import { CategoriesSeedService } from './seeds/categories-seed.service';
import { CategoriesController } from './categories.controller';
import { AmendementsController } from './amendements.controller';

@Module({
    imports: [TypeOrmModule.forFeature([Category, Law, Amendement])],
    controllers: [CategoriesController, AmendementsController],
    providers: [CategoriesSeedService, CategorizationService],
    exports: [TypeOrmModule, CategorizationService],
})
export class CategoriesModule { }
