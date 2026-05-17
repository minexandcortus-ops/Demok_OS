import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn, JoinColumn, Unique } from 'typeorm';
import { Law } from '../laws/law.entity';
import { Citizen } from '../users/citizen.entity';

import { VoteChoice } from './vote.types';
export { VoteChoice };

/**
 * Représente le vote d'un citoyen sur une loi spécifique.
 * Le couple (citoyen, loi) est unique pour éviter les votes multiples.
 */
@Entity()
@Unique(['citizen', 'law']) // One vote per citizen per law
export class Vote {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => Citizen, { eager: false })
    @JoinColumn()
    citizen: Citizen; // Link to Citizen (not User directly for privacy)

    @ManyToOne(() => Law, { eager: true })
    @JoinColumn()
    law: Law;

    @Column({
        type: 'simple-enum',
        enum: VoteChoice,
    })
    choice: VoteChoice;

    @CreateDateColumn()
    createdAt: Date;
}
