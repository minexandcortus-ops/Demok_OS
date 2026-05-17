import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { Law } from '../laws/law.entity';
import { Deputy } from './deputy.entity';
import { VoteChoice } from './vote.types';

/**
 * Vote officiel d'un député sur une loi spécifique.
 * Alimenté depuis les scrutins AN open data.
 * Contrainte unique : un député ne peut voter qu'une fois par loi.
 */
@Entity()
@Unique(['deputy', 'law'])
export class OfficialVote {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => Deputy)
    @JoinColumn()
    deputy: Deputy;

    @ManyToOne(() => Law)
    @JoinColumn()
    law: Law;

    @Column({
        type: 'simple-enum',
        enum: VoteChoice,
    })
    choice: VoteChoice;

    @Column({ type: 'date' })
    voteDate: Date;

    /**
     * Référence au scrutin AN (ex: "VTANR5L17V0001")
     */
    @Column({ nullable: true })
    scrutinId: string;
}
