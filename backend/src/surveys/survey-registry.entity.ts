import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, JoinColumn, Index } from 'typeorm';
import { Citizen } from '../users/citizen.entity';

@Entity('survey_registry')
@Index(['surveyId', 'citizenId'], { unique: true })
export class SurveyRegistry {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    surveyId: string; // ID du sondage (UUID ou slug)

    @Column()
    surveyType: string; // 'PRESIDENTIAL' | 'TOPIC'

    @Column()
    citizenId: string;

    @ManyToOne(() => Citizen)
    @JoinColumn({ name: 'citizenId' })
    citizen: Citizen;

    @CreateDateColumn()
    createdAt: Date;
}
