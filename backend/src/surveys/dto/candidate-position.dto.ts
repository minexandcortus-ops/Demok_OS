import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { DeclaredSourceType, LawPosition } from '../candidate-law-position.entity';

export class CandidatePositionDto {
    @IsUUID('4')
    candidateId: string;

    @IsUUID('4')
    lawId: string;

    @IsEnum(LawPosition, { message: 'Position invalide (POUR, CONTRE, ABSTENTION, NUANCE)' })
    position: LawPosition;

    @IsEnum(DeclaredSourceType, { message: 'Type de source invalide (DECLARATION ou PROGRAMME)' })
    sourceType: DeclaredSourceType;

    @Matches(/^https:\/\/\S+$/, { message: 'La source doit être une URL https://' })
    @MaxLength(1000)
    sourceUrl: string;

    @IsOptional()
    @IsString()
    @MaxLength(300, { message: 'La citation ne doit pas dépasser 300 caractères' })
    quote?: string;

    @IsDateString({}, { message: 'Date de la source invalide (AAAA-MM-JJ)' })
    sourceDate: string;

    @IsString()
    @IsNotEmpty({ message: 'Indiquez qui a vérifié la source' })
    @MaxLength(60)
    verifiedBy: string;
}
