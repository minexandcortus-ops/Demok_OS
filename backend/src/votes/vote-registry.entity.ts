import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn, Index, Unique } from 'typeorm';
import { Law } from '../laws/law.entity';
import { Citizen } from '../users/citizen.entity';

@Entity()
@Unique(['citizen', 'law'])
export class VoteRegistry {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => Citizen, { eager: false, onDelete: 'CASCADE' })
    citizen: Citizen;

    @ManyToOne(() => Law, { eager: false, onDelete: 'CASCADE' })
    law: Law;

    @CreateDateColumn()
    votedAt: Date;
}
