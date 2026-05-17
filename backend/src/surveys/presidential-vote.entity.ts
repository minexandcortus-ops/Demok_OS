import { Entity, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn, JoinColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { Candidate } from './candidate.entity';

@Entity()
export class PresidentialVote {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'userId' })
    user: User;

    @ManyToOne(() => Candidate)
    @JoinColumn({ name: 'candidateId' })
    candidate: Candidate;

    @CreateDateColumn()
    createdAt: Date;
}
