import { IsString, IsUUID, Matches } from 'class-validator';

export class VerifyOtpDto {
    @IsUUID('4', { message: 'Identifiant utilisateur invalide' })
    userId: string;

    @IsString()
    @Matches(/^\s*\d{6}\s*$/, { message: 'Le code doit contenir 6 chiffres' })
    code: string;
}

export class ResendOtpDto {
    @IsUUID('4', { message: 'Identifiant utilisateur invalide' })
    userId: string;
}
