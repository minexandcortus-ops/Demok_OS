import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SurveysController } from './surveys.controller';
import { SurveysService } from './surveys.service';
import { Candidate } from './candidate.entity';
import { User } from '../users/user.entity';
import { TopicPoll } from './topic-poll.entity';
import { TopicPollService } from './topic-poll.service';
import { TopicPollController } from './topic-poll.controller';
import { SurveyRegistry } from './survey-registry.entity';
import { SurveyUrna } from './survey-urna.entity';
import { Citizen } from '../users/citizen.entity';
import { CandidatesSyncService } from './candidates-sync.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Candidate, 
            User, 
            Citizen, 
            TopicPoll, 
            SurveyRegistry, 
            SurveyUrna
        ])
    ],
    controllers: [SurveysController, TopicPollController],
    providers: [SurveysService, TopicPollService, CandidatesSyncService],
    exports: [SurveysService, TopicPollService, CandidatesSyncService]
})
export class SurveysModule { }
