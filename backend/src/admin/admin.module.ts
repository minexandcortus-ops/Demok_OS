import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminIngestionController } from './admin-ingestion.controller';
import { HealthController } from './health.controller';
import { AdminReportsController, AdminLawsController } from './admin-reports.controller';
import { AdminPollsController } from './admin-polls.controller';
import { IngestionModule } from '../ingestion/ingestion.module';
import { Law } from '../laws/law.entity';
import { Amendement } from '../laws/amendement.entity';
import { Report } from '../reports/entities/report.entity';
import { ReportsModule } from '../reports/reports.module';
import { NotificationModule } from '../notifications/notification.module';

import { Citizen } from '../users/citizen.entity';
import { VoteUrna } from '../votes/vote-choice.entity';
import { TopicPoll } from '../surveys/topic-poll.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([Law, Amendement, Report, Citizen, VoteUrna, TopicPoll]),
        IngestionModule,
        ReportsModule,

        NotificationModule, // Expose NotificationService via ses exports
    ],
    controllers: [
        AdminIngestionController,
        HealthController,
        AdminReportsController,
        AdminLawsController,

        AdminPollsController,
    ],
})
export class AdminModule { }
