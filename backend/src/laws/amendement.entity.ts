import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Law } from './law.entity';

export enum AmendementStatut {
    ADOPTE = 'ADOPTE',
    REJETE = 'REJETE',
    RETIRE = 'RETIRE',
    NON_DEFENDU = 'NON_DEFENDU',
    EN_DISCUSSION = 'EN_DISCUSSION',
    TOMBE = 'TOMBE',
}

@Entity()
export class Amendement {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    externalId: string; // ex: "AN_AMANR5L17PO744169B0001"

    @ManyToOne(() => Law, law => law.amendements, { onDelete: 'CASCADE' })
    @JoinColumn()
    law: Law;

    @Column()
    numero: string;

    @Column('text')
    auteur: string;

    @Column('text', { nullable: true })
    texte: string;

    @Column({
        type: 'simple-enum',
        enum: AmendementStatut,
        default: AmendementStatut.EN_DISCUSSION,
    })
    statut: AmendementStatut;

    @Column({ type: 'date', nullable: true })
    dateDepot: Date;

    @Column({ type: 'varchar', nullable: true })
    sort: string; // Issue du scrutin (adopté, rejeté...)

    @Column({ type: 'varchar', nullable: true })
    xmlUrl: string; // URL du fichier XML source (pour enrichissement)

    @Column('text', { nullable: true })
    resume: string; // Résumé factuel 1 ligne généré par Mistral IA
}
