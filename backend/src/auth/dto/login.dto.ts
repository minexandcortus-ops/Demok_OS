import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { PASSWORD_MAX_LENGTH } from '../../common/patterns';

export class LoginDto {
    /** Pseudo ou adresse email */
    @IsString()
    @IsNotEmpty({ message: 'Pseudo ou email requis' })
    @MaxLength(254)
    pseudo: string;

    // Pas de longueur minimale : les comptes existants peuvent avoir des mots de passe plus courts.
    @IsString()
    @IsNotEmpty({ message: 'Mot de passe requis' })
    @MaxLength(PASSWORD_MAX_LENGTH)
    password: string;
}

export interface LoginResponseDto {
    success: boolean;
    userId?: string;
    citizenId?: string;
    pseudo?: string;
    message?: string;
}
