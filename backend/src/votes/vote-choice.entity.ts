import { Entity, Column, PrimaryColumn, ManyToOne, CreateDateColumn, Index } from 'typeorm';
import { Law } from '../laws/law.entity';

import { VoteChoice } from './vote.types';

@Entity()
export class VoteUrna {
    /**
     * voterToken = HMAC(citizenId + lawId, VOTE_SECRET)
     * This unique token identifies the vote for a specific law without revealing the user.
     */
    @PrimaryColumn()
    voterToken: string;

    @ManyToOne(() => Law, { eager: false, onDelete: 'CASCADE' })
    law: Law;

    @Column({
        type: 'simple-enum',
        enum: VoteChoice,
    })
    choice: VoteChoice;

    @CreateDateColumn()
    createdAt: Date;
}
