import {
    IsEmail,
    IsInt,
    IsOptional,
    IsString,
    Matches,
    Max,
    MaxLength,
    Min,
    MinLength,
} from 'class-validator';
import { FRENCH_POSTAL_CODE, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../../common/patterns';

export class OnboardingDto {
    @IsString({ message: 'Le pseudo est requis' })
    @Matches(/^\S{1,20}$/, { message: 'Le pseudo est invalide (1 à 20 caractères, sans espace)' })
    pseudo: string;

    @IsInt({ message: "L'année de naissance doit être un nombre entier" })
    @Min(1850, { message: "L'année de naissance est invalide" })
    @Max(new Date().getFullYear(), { message: "L'année de naissance est invalide" })
    birthYear: number;

    @IsString({ message: 'Le code postal est requis' })
    @Matches(FRENCH_POSTAL_CODE, { message: 'Le code postal est invalide' })
    postalCode: string;

    @IsOptional()
    @IsString()
    @MaxLength(10)
    constituencyCode?: string;

    @IsEmail({}, { message: "L'adresse email est invalide" })
    @MaxLength(254)
    email: string;

    @IsString({ message: 'Le mot de passe est requis' })
    @MinLength(PASSWORD_MIN_LENGTH, { message: `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères` })
    @MaxLength(PASSWORD_MAX_LENGTH, { message: `Le mot de passe ne doit pas dépasser ${PASSWORD_MAX_LENGTH} caractères` })
    password: string;
}

export interface OnboardingResponseDto {
    success: boolean;
    userId?: string;
    message?: string;
    needsConstituencyChoice?: boolean;
    constituencyOptions?: Array<{ id: string; name: string }>;
}
