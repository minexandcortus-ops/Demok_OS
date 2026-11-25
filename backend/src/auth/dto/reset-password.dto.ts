import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../../common/patterns';

export class ResetPasswordDto {
    @IsNotEmpty()
    @IsString()
    @MaxLength(256)
    token: string;

    @IsString()
    @MinLength(PASSWORD_MIN_LENGTH, { message: `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères` })
    @MaxLength(PASSWORD_MAX_LENGTH, { message: `Le mot de passe ne doit pas dépasser ${PASSWORD_MAX_LENGTH} caractères` })
    newPassword: string;
}
