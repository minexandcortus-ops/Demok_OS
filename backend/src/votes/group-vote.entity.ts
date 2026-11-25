import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Law } from '../laws/law.entity';

/** Position majoritaire d'un groupe sur un scrutin. MIXED = égalité entre options. */
export enum GroupPosition {
    FOR = 'FOR',
    AGAINST = 'AGAINST',
    ABSTAIN = 'ABSTAIN',
    MIXED = 'MIXED',
}

/**
 * Décompte d'un groupe politique de l'Assemblée sur le scrutin retenu pour une loi.
 * Les choix sont exprimés sur la loi (inversés pour une motion de rejet).
 */
@Entity()
@Unique(['law', 'organeRef'])
export class GroupVote {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => Law, { onDelete: 'CASCADE' })
    @JoinColumn()
    law: Law;

    @Column()
    scrutinId: string;

    /** Identifiant d'organe AN (ex. « PO845401 ») */
    @Column()
    organeRef: string;

    /** Libellé lisible du groupe */
    @Column()
    label: string;

    @Column({ type: 'int', default: 0 })
    pour: number;

    @Column({ type: 'int', default: 0 })
    contre: number;

    @Column({ type: 'int', default: 0 })
    abstention: number;

    @Column({ type: 'int', default: 0 })
    nonVotants: number;

    @Column({ type: 'enum', enum: GroupPosition })
    position: GroupPosition;

    @CreateDateColumn()
    createdAt: Date;
}
