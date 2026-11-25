import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ServeStaticModule } from '@nestjs/serve-static';
import { buildTypeOrmOptions } from './database/typeorm.config';
import { join } from 'path';
import { IngestionModule } from './ingestion/ingestion.module';
import { AuthModule } from './auth/auth.module';
import { VotesModule } from './votes/votes.module';
import { GroupVotesModule } from './votes/group-votes.module';
import { UsersModule } from './users/users.module';
import { GamificationModule } from './gamification/gamification.module';
import { CategoriesModule } from './laws/categories.module';
import { SurveysModule } from './surveys/surveys.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { NotificationModule } from './notifications/notification.module';
import { AdminModule } from './admin/admin.module';
import { DeputiesModule } from './deputies/deputies.module';

import { GovernmentModule } from './government/government.module';
import { ReportsModule } from './reports/reports.module';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),

        // Bull Queue avec Redis (Phase 3)
        BullModule.forRoot({
            redis: process.env.REDIS_URL,
        }),
        
        ServeStaticModule.forRoot({
            rootPath: join(__dirname, '..', 'uploads'),
            serveRoot: '/uploads',
        }),

        TypeOrmModule.forRoot(buildTypeOrmOptions()),
        EventEmitterModule.forRoot({ global: true }),
        IngestionModule,
        AuthModule,
        VotesModule,
        GroupVotesModule,
        UsersModule,
        GamificationModule,
        CategoriesModule,
        SurveysModule,
        SchedulerModule,
        NotificationModule,
        AdminModule,
        DeputiesModule,

        GovernmentModule,
        ReportsModule,
    ],
    controllers: [],
    providers: [],
})
export class AppModule { }
