import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminIngestionController } from './admin-ingestion.controller';
import { HealthController } from './health.controller';
import { AdminReportsController, AdminLawsController } from './admin-reports.controller';
import { AdminDebatesController } from './admin-debates.controller';
import { IngestionModule } from '../ingestion/ingestion.module';
import { Law } from '../laws/law.entity';
import { Amendement } from '../laws/amendement.entity';
import { Report } from '../reports/entities/report.entity';
import { OpinionReport } from '../debates/entities/opinion-report.entity';
import { ReportsModule } from '../reports/reports.module';
import { DebatesModule } from '../debates/debates.module';

import { Citizen } from '../users/citizen.entity';
import { Vote } from '../votes/vote.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([Law, Amendement, Report, OpinionReport, Citizen, Vote]),
        IngestionModule,
        ReportsModule,
        DebatesModule,
    ],
    controllers: [
        AdminIngestionController,
        HealthController,
        AdminReportsController,
        AdminLawsController,
        AdminDebatesController,
    ],
})
export class AdminModule { }

