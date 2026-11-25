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
import { CandidatesSyncService } from './candidates-sync.service';
import { CandidateLawPosition } from './candidate-law-position.entity';
import { CandidatePositionsService } from './candidate-positions.service';
import { CandidatePositionsController } from './candidate-positions.controller';
import { OfficialVote } from '../votes/official-vote.entity';
import { GroupVote } from '../votes/group-vote.entity';
import { Law } from '../laws/law.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Candidate, 
            PresidentialVote, 
            User, 
            Citizen, 
            TopicPoll, 
            SurveyRegistry, 
            SurveyUrna,
            CandidateLawPosition,
            OfficialVote,
            GroupVote,
            Law,
        ])
    ],
    controllers: [SurveysController, TopicPollController, CandidatePositionsController],
    providers: [SurveysService, TopicPollService, CandidatesSyncService, CandidatePositionsService],
    exports: [SurveysService, TopicPollService, CandidatesSyncService, CandidatePositionsService]
})
export class SurveysModule { }
