import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, Unique } from 'typeorm';
import { User } from '../users/user.entity';
import { Law } from './law.entity';

@Entity('law_favorite')
@Unique(['user', 'law']) // A user can only favorite a law once
export class LawFavorite {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @ManyToOne(() => Law, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'lawId' })
    law: Law;

    @CreateDateColumn()
    createdAt: Date;
}
