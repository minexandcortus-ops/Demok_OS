import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { HttpModule } from '@nestjs/axios';
import { GovernmentService } from './government.service';
import { GovernmentController } from './government.controller';

@Module({
  imports: [ScheduleModule.forRoot(), HttpModule],
  providers: [GovernmentService],
  controllers: [GovernmentController],
  exports: [GovernmentService]
})
export class GovernmentModule {}
