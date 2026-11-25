import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ReportCategory } from '../entities/report.entity';

export class CreateReportDto {
    @IsUUID('4', { message: 'Identifiant de loi invalide' })
    lawId: string;

    @IsEnum(ReportCategory, { message: 'Catégorie de signalement invalide' })
    category: ReportCategory;

    @IsOptional()
    @IsString()
    @MaxLength(2000, { message: 'La description ne doit pas dépasser 2000 caractères' })
    description: string;
}
