import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { IngestionSchedulerService } from './ingestion-scheduler.service';
import { IngestionModule } from '../ingestion/ingestion.module';

@Module({
    imports: [
        ScheduleModule.forRoot(),
        IngestionModule,
    ],
    providers: [
        IngestionSchedulerService,
    ],
})
export class SchedulerModule { }
