
import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, Column, Unique } from 'typeorm';
import { User } from '../../users/user.entity';
import { Opinion } from './opinion.entity';

@Entity()
@Unique(['userId', 'opinionId']) // Un utilisateur ne peut moker qu'une fois par avis
export class OpinionMoke {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column()
    userId: string;

    @ManyToOne(() => Opinion, (opinion) => opinion.mokesList, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'opinionId' })
    opinion: Opinion;

    @Column()
    opinionId: string;

    @CreateDateColumn()
    createdAt: Date;
}
