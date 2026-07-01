import { Entity, Column, PrimaryGeneratedColumn, ManyToMany, JoinTable, OneToMany } from 'typeorm';
import { Category } from './category.entity';
import { Amendement } from './amendement.entity';

export enum LawStatus {
    UPCOMING = 'UPCOMING',        // À venir (inscrite à l'ordre du jour, date future)
    PENDING = 'PENDING',          // En cours (date passée, scrutin attendu)
    VOTED_AN = 'VOTED_AN',        // Votée à l'Assemblée Nationale
    AT_SENATE = 'AT_SENATE',      // En navette au Sénat
    VALIDATED = 'VALIDATED',      // Promulguée (adoptée définitivement)
    REJECTED = 'REJECTED',        // Rejetée définitivement
}

export enum LawRegion {
    FRANCE = 'FRANCE',
    UE = 'UE',
}

export enum CurrentSource {
    AN = 'AN',
    SENAT = 'SENAT',
    BOTH = 'BOTH',
}

export enum NavetteStatus {
    PREMIERE_LECTURE_AN = 'premiere_lecture_an',
    PREMIERE_LECTURE_SENAT = 'premiere_lecture_senat',
    DEUXIEME_LECTURE_AN = 'deuxieme_lecture_an',
    DEUXIEME_LECTURE_SENAT = 'deuxieme_lecture_senat',
    COMMISSION_MIXTE_PARITAIRE = 'commission_mixte_paritaire',
    LECTURE_DEFINITIVE_AN = 'lecture_definitive_an',
    PROMULGUEE = 'promulguee',
}

/**
 * Représente un projet ou une proposition de loi.
 * Gère les titres (officiel/vulgarisé), le résumé, le statut et les catégories.
 */
@Entity()
export class Law {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    externalId: string; // ID from source (e.g., AN id)

    @Column('text')
    titleOfficial: string;

    @Column('text', { nullable: true })
    titleVulgarized: string;

    @Column('jsonb', { nullable: true })
    summary: {
        sections: Record<string, string>; // category name -> explanation
        pro: string[];
        con: string[];
    };

    @Column({
        type: 'simple-enum',
        enum: LawStatus,
        default: LawStatus.PENDING,
    })
    status: LawStatus;

    @Column({ type: 'date', nullable: true })
    voteDate: Date;

    @Column({ default: 'Ass. Nat.' })
    source: string;

    @Column({
        type: 'simple-enum',
        enum: LawRegion,
        default: LawRegion.FRANCE,
    })
    region: LawRegion;

    @ManyToMany(() => Category, category => category.laws)
    @JoinTable({
        name: 'law_categories',
        joinColumn: { name: 'law_id', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'category_id', referencedColumnName: 'id' }
    })
    categories: Category[];

    @OneToMany(() => Amendement, amendement => amendement.law)
    amendements: Amendement[];

    // ========== Ingestion System Fields ==========

    /**
     * Hash SHA-256 du contenu pour détecter les modifications
     */
    @Column({ type: 'varchar', length: 64, nullable: true })
    contentHash?: string;

    /**
     * Source actuelle de la loi (AN, SENAT, ou BOTH si navette)
     */
    @Column({
        type: 'simple-enum',
        enum: CurrentSource,
        default: CurrentSource.AN,
    })
    currentSource: CurrentSource;

    /**
     * Statut dans la navette parlementaire
     */
    @Column({
        type: 'simple-enum',
        enum: NavetteStatus,
        nullable: true,
    })
    navetteStatus?: NavetteStatus;

    /**
     * Date de la dernière modification de contenu détectée
     */
    @Column({ type: 'timestamp', nullable: true })
    lastModifiedAt?: Date;

    /**
     * Nombre de fois que la loi a été modifiée
     */
    @Column({ type: 'int', default: 0 })
    modificationCount: number;

    /**
     * Historique de la navette parlementaire (JSON)
     */
    @Column({ type: 'jsonb', nullable: true })
    navetteHistory?: Array<{
        chamber: 'AN' | 'SENAT';
        readingNumber: number;
        date: string;
        contentHash: string;
    }>;

    /**
     * URL vers la loi sur le site officiel
     */
    @Column({ type: 'varchar', nullable: true })
    officialUrl?: string;

    /**
     * Date du premier dépôt de la loi
     */
    @Column({ type: 'date', nullable: true })
    dateDepot?: Date;

    /**
     * Date de promulgation (si promulguée)
     */
    @Column({ type: 'date', nullable: true })
    datePromulgation?: Date;

    /**
     * Nombre de navettes (étapes de lecture)
     */
    @Column({ type: 'int', default: 0 })
    navetteCount: number;

    @Column({ nullable: true })
    latestTextUrl?: string; // e.g. https://www.assemblee-nationale.fr/dyn/17/textes/l17b2413_texte-adopte.pdf

    @Column({ nullable: true })
    latestTextType?: string; // e.g. "Texte adopté en 1ère lecture", "Texte de la commission"

    /**
     * Texte intégral (brut) de la loi, extrait pour l'analyse IA
     */
    @Column({ type: 'text', nullable: true })
    rawText?: string;

    /**
     * Procédure accélérée engagée ?
     */
    @Column({ default: false })
    procedureAcceleree: boolean;

    // ========== Agenda System Fields ==========

    /**
     * Date de passage à l'ordre du jour
     */
    @Column({ type: 'date', nullable: true })
    agendaDate: Date;

    /**
     * Indique si la loi est inscrite à l'ordre du jour
     */
    @Column({ default: false })
    isOnAgenda: boolean;

    // ========== Deputy Vote Result ==========

    /**
     * Résultat agrégé du vote des députés à l'Assemblée Nationale.
     * Alimenté automatiquement depuis les scrutins AN open data ou le scraping de secours.
     */
    @Column({ type: 'jsonb', nullable: true })
    deputyVoteResult?: {
        pour: number;
        contre: number;
        abstention: number;
        nonVotants: number;
        total: number;
        adopted: boolean;
        scrutinId?: string;
        dateScrutin?: string;
        isProvisional?: boolean;
        isSimplified?: boolean;
        /** Cas 3 : vote à main levée (pas de décompte officiel) */
        isMainLevee?: boolean;
        /** Type de procédure de vote */
        voteType?: 'scrutin_public' | 'article_unique' | 'main_levee' | 'tacite';
        /** Indique si les votes proviennent d'une motion de rejet inversée */
        isMotionDeRejet?: boolean;
    };

    /**
     * URL du compte rendu de séance (optionnel)
     * Utilisé pour le scraping en temps réel lorsque le scrutin n'est pas encore publié.
     */
    @Column({ nullable: true })
    compteRenduUrl?: string;

    /**
     * Liste des numéros de documents associés (PJL n°, PPL n°, Rapport n°)
     * Utilisé pour le matching précis lors du scraping des séances.
     */
    @Column({ type: 'jsonb', nullable: true, name: 'document_numbers' })
    documentNumbers?: string[];

    /**
     * Info de report du vote (Cas 4)
     * Rempli quand un vote prévu est reporté à une séance ultérieure.
     * Affiché dans la fiche détail de la loi.
     */
    @Column({ type: 'varchar', nullable: true })
    votePostponedInfo?: string;
}
