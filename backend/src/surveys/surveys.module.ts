import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SurveysController } from './surveys.controller';
import { SurveysService } from './surveys.service';
import { Candidate } from './candidate.entity';
import { PresidentialVote } from './presidential-vote.entity';
import { User } from '../users/user.entity';
import { TopicPoll } from './topic-poll.entity';
import { TopicPollService } from './topic-poll.service';
import { TopicPollController } from './topic-poll.controller';
import { SurveyRegistry } from './survey-registry.entity';
import { SurveyUrna } from './survey-urna.entity';
import { Citizen } from '../users/citizen.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Candidate, 
            PresidentialVote, 
            User, 
            Citizen, 
            TopicPoll, 
            SurveyRegistry, 
            SurveyUrna
        ])
    ],
    controllers: [SurveysController, TopicPollController],
    providers: [SurveysService, TopicPollService],
    exports: [SurveysService, TopicPollService]
})
export class SurveysModule { }
