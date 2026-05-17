import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('survey_urna')
@Index(['surveyId', 'voterToken'], { unique: true })
export class SurveyUrna {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    surveyId: string;

    @Column()
    voterToken: string; // HMAC_SHA256(VOTE_SECRET, "CITIZEN_ID:SURVEY_ID")

    @Column()
    choiceId: string; // ID du candidat ou 'pour'/'contre'/'neutre'

    @CreateDateColumn()
    createdAt: Date;
}
