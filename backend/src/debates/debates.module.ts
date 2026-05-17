
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DebatesController } from './debates.controller';
import { DebatesService } from './debates.service';
import { Opinion } from './entities/opinion.entity';
import { OpinionMoke } from './entities/opinion-moke.entity';
import { OpinionReport } from './entities/opinion-report.entity';
import { Citizen } from '../users/citizen.entity';
import { Law } from '../laws/law.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([Opinion, OpinionMoke, OpinionReport, Citizen, Law]),
    ],
    controllers: [DebatesController],
    providers: [DebatesService],
    exports: [DebatesService],
})
export class DebatesModule { }
