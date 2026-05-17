
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { User } from '../../users/user.entity';
import { Law } from '../../laws/law.entity';
import { OpinionMoke } from './opinion-moke.entity';
import { OpinionReport } from './opinion-report.entity';

@Entity()
export class Opinion {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ length: 160 })
    content: string;

    @Column({ type: 'int', default: 0 })
    mokes: number;

    @CreateDateColumn()
    createdAt: Date;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column()
    userId: string;

    @ManyToOne(() => Law, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'lawId' })
    law: Law;

    @Column()
    lawId: string;

    @OneToMany(() => OpinionMoke, (moke) => moke.opinion)
    mokesList: OpinionMoke[];

    @OneToMany(() => OpinionReport, (report) => report.opinion)
    reportsList: OpinionReport[];
}
