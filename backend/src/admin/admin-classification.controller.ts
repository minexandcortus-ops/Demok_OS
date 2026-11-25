import { BadRequestException, Body, Controller, Param, ParseUUIDPipe, Patch, UseGuards, ValidationPipe } from '@nestjs/common';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { AdminKeyGuard } from './admin-key.guard';
import { CategorizationService } from '../laws/categorization.service';
import { Territory } from '../laws/taxonomy';

export class LawClassificationDto {
    @IsArray()
    @ArrayNotEmpty({ message: 'Au moins un thème est requis' })
    @ArrayMaxSize(3, { message: '3 thèmes maximum (le premier est le thème principal)' })
    @IsString({ each: true })
    categorySlugs: string[];

    @IsArray()
    @IsIn(Object.values(Territory), { each: true, message: 'Code de territoire inconnu' })
    territories: string[];

    @IsOptional()
    @IsBoolean()
    locked?: boolean;
}

/** Correction manuelle de la classification thème × territoire d'une loi. */
@UseGuards(AdminKeyGuard)
@Controller('admin/laws')
export class AdminClassificationController {
    constructor(private readonly categorizationService: CategorizationService) { }

    @Patch(':id/classification')
    async setClassification(
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body(new ValidationPipe({ whitelist: true, transform: true })) dto: LawClassificationDto,
    ) {
        try {
            const law = await this.categorizationService.setManualClassification(
                id,
                dto.categorySlugs,
                dto.territories,
                dto.locked ?? true,
            );
            return {
                success: true,
                categories: law.categories.map((c) => c.slug),
                territories: law.territories,
                categoriesLocked: law.categoriesLocked,
            };
        } catch (e) {
            throw new BadRequestException(e.message);
        }
    }
}
