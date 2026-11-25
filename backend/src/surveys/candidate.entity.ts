import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Statut de candidature, affiché tel quel dans l'application. */
export enum CandidateStatus {
    PRESSENTI = 'PRESSENTI',
    DECLARE = 'DECLARE',
    /** Liste officielle publiée par le Conseil constitutionnel */
    OFFICIEL = 'OFFICIEL',
    RETIRE = 'RETIRE',
    /** Masqué de l'application (choix éditorial) ; la synchronisation ne le recrée pas */
    MASQUE = 'MASQUE',
}

/** État de publication du programme officiel. */
export enum ProgramStatus {
    NON_PUBLIE = 'NON_PUBLIE',
    PARTIEL = 'PARTIEL',
    PUBLIE = 'PUBLIE',
}

@Entity()
export class Candidate {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column()
    party: string;

    @Column({ nullable: true })
    photoUrl: string;

    @Column({ nullable: true })
    partyLogoUrl: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    /** Fiche de synthèse tierce (ex. candidatspresidentielles2027.fr) — pas le programme officiel */
    @Column({ nullable: true })
    programUrl: string;

    @Column({ default: 0 })
    displayOrder: number; // For ordering candidates in the UI

    @Column({ type: 'enum', enum: CandidateStatus, default: CandidateStatus.DECLARE })
    status: CandidateStatus;

    /** Site officiel de campagne */
    @Column({ type: 'varchar', nullable: true })
    officialSiteUrl: string | null;

    /** Programme officiel (page ou PDF publié par l'équipe de campagne) */
    @Column({ type: 'varchar', nullable: true })
    officialProgramUrl: string | null;

    @Column({ type: 'enum', enum: ProgramStatus, default: ProgramStatus.NON_PUBLIE })
    programStatus: ProgramStatus;

    @Column({ type: 'date', nullable: true })
    programPublishedAt: string | null;

    /** Dernière vérification manuelle des liens officiels */
    @Column({ type: 'timestamp', nullable: true })
    linksCheckedAt: Date | null;
}

/** Statuts visibles dans l'application publique. */
export const VISIBLE_CANDIDATE_STATUSES = [
    CandidateStatus.PRESSENTI,
    CandidateStatus.DECLARE,
    CandidateStatus.OFFICIEL,
    CandidateStatus.RETIRE,
];
