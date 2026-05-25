import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { IngestionModule } from './ingestion/ingestion.module';
import { Law } from './laws/law.entity';
import { LawFavorite } from './laws/law-favorite.entity';
import { User } from './users/user.entity';
import { Citizen } from './users/citizen.entity';
import { Constituency } from './users/constituency.entity';
import { AuthModule } from './auth/auth.module';
import { VoteRegistry } from './votes/vote-registry.entity';
import { VoteUrna } from './votes/vote-choice.entity';
import { Deputy } from './votes/deputy.entity';
import { OfficialVote } from './votes/official-vote.entity';
import { VotesModule } from './votes/votes.module';
import { UsersModule } from './users/users.module';
import { CitizenLevel } from './gamification/entities/citizen-level.entity';
import { GamificationModule } from './gamification/gamification.module';
import { Category } from './laws/category.entity';
import { Amendement } from './laws/amendement.entity';
import { CategoriesModule } from './laws/categories.module';
import { SurveysModule } from './surveys/surveys.module';
import { Candidate } from './surveys/candidate.entity';
import { PresidentialVote } from './surveys/presidential-vote.entity';
import { TopicPoll } from './surveys/topic-poll.entity';
import { SchedulerModule } from './scheduler/scheduler.module';
import { NotificationModule } from './notifications/notification.module';
import { AdminModule } from './admin/admin.module';
import { DebatesModule } from './debates/debates.module';
import { Opinion } from './debates/entities/opinion.entity';
import { OpinionMoke } from './debates/entities/opinion-moke.entity';
import { OpinionReport } from './debates/entities/opinion-report.entity';
import { GovernmentModule } from './government/government.module';
import { ReportsModule } from './reports/reports.module';
import { Report } from './reports/entities/report.entity';
import { SurveyRegistry } from './surveys/survey-registry.entity';
import { SurveyUrna } from './surveys/survey-urna.entity';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),

        // Bull Queue avec Redis (Phase 3)
        BullModule.forRoot({
            redis: process.env.REDIS_URL,
        }),

        TypeOrmModule.forRoot({
            type: 'postgres',
            host: process.env.DATABASE_HOST || 'localhost',
            port: parseInt(process.env.DATABASE_PORT || '5432', 10),
            username: process.env.DATABASE_USER || 'Démok_user',
            password: process.env.DATABASE_PASSWORD || 'Démok_password',
            database: process.env.DATABASE_NAME || 'Démok_db',
            entities: [
                Law, LawFavorite, User, Citizen, Constituency, 
                VoteRegistry, VoteUrna, Deputy, OfficialVote, 
                CitizenLevel, Category, Amendement, Candidate, 
                PresidentialVote, Opinion, OpinionMoke, OpinionReport, TopicPoll,
                Report, SurveyRegistry, SurveyUrna
            ],
            synchronize: process.env.NODE_ENV !== 'production', // Use migrations in production
        }),
        EventEmitterModule.forRoot({ global: true }),
        IngestionModule,
        AuthModule,
        VotesModule,
        UsersModule,
        GamificationModule,
        CategoriesModule,
        SurveysModule,
        SchedulerModule,
        NotificationModule,
        AdminModule,
        DebatesModule,
        GovernmentModule,
        ReportsModule,
    ],
    controllers: [],
    providers: [],
})
export class AppModule { }
