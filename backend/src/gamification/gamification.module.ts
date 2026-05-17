import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CitizenLevel } from './entities/citizen-level.entity';
import { Citizen } from '../users/citizen.entity';
import { VoteRegistry } from '../votes/vote-registry.entity';
import { Law } from '../laws/law.entity';
import { LevelsSeedService } from './seeds/levels-seed.service';
import { GamificationService } from './gamification.service';
import { GamificationController } from './gamification.controller';

@Module({
    imports: [TypeOrmModule.forFeature([CitizenLevel, Citizen, VoteRegistry, Law])],
    controllers: [GamificationController],
    providers: [LevelsSeedService, GamificationService],
    exports: [TypeOrmModule, GamificationService],
})
export class GamificationModule { }
