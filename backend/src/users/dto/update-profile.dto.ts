import { IsBoolean, IsEmail, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { FRENCH_POSTAL_CODE } from '../../common/patterns';

export class UpdateProfileDto {
    @IsOptional()
    @IsEmail({}, { message: "L'adresse email est invalide" })
    @MaxLength(254)
    email?: string;

    @IsOptional()
    @IsString()
    @Matches(FRENCH_POSTAL_CODE, { message: 'Le code postal est invalide' })
    postalCode?: string;

    @IsOptional()
    @IsString()
    @MaxLength(10)
    constituencyCode?: string;

    @IsOptional()
    @IsBoolean()
    notifyLawResults?: boolean;

    @IsOptional()
    @IsBoolean()
    notifyUpcomingLaws?: boolean;

    @IsOptional()
    @IsBoolean()
    notifySurveyResults?: boolean;

    @IsOptional()
    @IsBoolean()
    notifyNewSurveys?: boolean;
}

export class UpdateFcmTokenDto {
    @IsOptional()
    @IsString()
    @MaxLength(4096)
    fcmToken: string;
}
