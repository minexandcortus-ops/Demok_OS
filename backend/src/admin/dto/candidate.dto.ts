import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, Matches, MaxLength, ValidateIf } from 'class-validator';
import { CandidateStatus, ProgramStatus } from '../../surveys/candidate.entity';

/** Lien externe en HTTPS ou fichier déposé via /admin/candidates/upload. */
const LINK = /^(https:\/\/\S+|\/api\/uploads\/\S+)$/;
const LINK_MESSAGE = 'doit être une URL https:// ou un fichier /api/uploads/…';

export class CandidateDto {
    @IsOptional()
    @IsString()
    @MaxLength(120)
    name?: string;

    @IsOptional()
    @IsString()
    @MaxLength(120)
    party?: string;

    @IsOptional()
    @IsString()
    @MaxLength(5000)
    description?: string;

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    photoUrl?: string;

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    partyLogoUrl?: string;

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    programUrl?: string;

    @IsOptional()
    @IsEnum(CandidateStatus)
    status?: CandidateStatus;

    @IsOptional()
    @ValidateIf((_, v) => v !== null && v !== '')
    @Matches(LINK, { message: `officialSiteUrl ${LINK_MESSAGE}` })
    @MaxLength(1000)
    officialSiteUrl?: string | null;

    @IsOptional()
    @ValidateIf((_, v) => v !== null && v !== '')
    @Matches(LINK, { message: `officialProgramUrl ${LINK_MESSAGE}` })
    @MaxLength(1000)
    officialProgramUrl?: string | null;

    @IsOptional()
    @IsEnum(ProgramStatus)
    programStatus?: ProgramStatus;

    @IsOptional()
    @ValidateIf((_, v) => v !== null && v !== '')
    @IsDateString()
    programPublishedAt?: string | null;

    /** Député correspondant (si le candidat est ou a été député) */
    @IsOptional()
    @ValidateIf((_, v) => v !== null && v !== '')
    @IsUUID('4', { message: 'deputyId doit être un identifiant de député' })
    deputyId?: string | null;

    /** Groupe AN de sa formation (code d'organe « PO… ») */
    @IsOptional()
    @ValidateIf((_, v) => v !== null && v !== '')
    @Matches(/^PO\d+$/, { message: 'groupOrganeRef doit être un code d\'organe AN (ex. PO845401)' })
    groupOrganeRef?: string | null;
}

const LINK_FIELDS: (keyof CandidateDto)[] = ['officialSiteUrl', 'officialProgramUrl', 'programStatus', 'programPublishedAt'];

/**
 * Normalise les champs officiels avant enregistrement :
 * chaînes vides → null, date de vérification mise à jour dès qu'un champ officiel est fourni,
 * statut de programme déduit (PUBLIE) si un lien officiel est saisi sans statut.
 */
export function prepareCandidateUpdate(dto: CandidateDto, now: Date = new Date()): Record<string, unknown> {
    const data: Record<string, unknown> = { ...dto };
    for (const key of ['officialSiteUrl', 'officialProgramUrl', 'programPublishedAt', 'deputyId', 'groupOrganeRef'] as const) {
        if (data[key] === '') data[key] = null;
    }
    if (data.officialProgramUrl && !data.programStatus) {
        data.programStatus = ProgramStatus.PUBLIE;
    }
    if (LINK_FIELDS.some((key) => key in dto)) {
        data.linksCheckedAt = now;
    }
    return data;
}
