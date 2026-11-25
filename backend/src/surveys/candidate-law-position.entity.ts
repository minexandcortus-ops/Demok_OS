import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
import { Candidate } from './candidate.entity';
import { Law } from '../laws/law.entity';

export enum LawPosition {
    POUR = 'POUR',
    CONTRE = 'CONTRE',
    ABSTENTION = 'ABSTENTION',
    NUANCE = 'NUANCE',
}

/** Sources saisies manuellement. Les votes (personnel / groupe) sont déduits, jamais saisis. */
export enum DeclaredSourceType {
    DECLARATION = 'DECLARATION',
    PROGRAMME = 'PROGRAMME',
}

/**
 * Position déclarée d'un candidat sur une loi, toujours sourcée et vérifiée par un humain.
 * Aucune position n'est générée par l'IA.
 */
@Entity()
@Unique(['candidate', 'law'])
export class CandidateLawPosition {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => Candidate, { onDelete: 'CASCADE' })
    @JoinColumn()
    candidate: Candidate;

    @ManyToOne(() => Law, { onDelete: 'CASCADE' })
    @JoinColumn()
    law: Law;

    @Column({ type: 'enum', enum: LawPosition })
    position: LawPosition;

    @Column({ type: 'enum', enum: DeclaredSourceType })
    sourceType: DeclaredSourceType;

    @Column()
    sourceUrl: string;

    /** Citation courte (≤ 300 caractères) */
    @Column({ type: 'varchar', length: 300, nullable: true })
    quote: string | null;

    @Column({ type: 'date' })
    sourceDate: string;

    /** Qui a vérifié la source (pseudo ou initiales de l'administrateur) */
    @Column()
    verifiedBy: string;

    @UpdateDateColumn()
    verifiedAt: Date;

    @CreateDateColumn()
    createdAt: Date;
}
