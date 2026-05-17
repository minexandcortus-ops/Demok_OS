import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { User } from '../../users/user.entity';
import { Opinion } from './opinion.entity';

@Entity()
@Unique(['userId', 'opinionId'])
export class OpinionReport {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column()
    userId: string;

    @ManyToOne(() => Opinion, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'opinionId' })
    opinion: Opinion;

    @Column()
    opinionId: string;

    @Column({ nullable: true })
    reason: string;

    @CreateDateColumn()
    createdAt: Date;
}
