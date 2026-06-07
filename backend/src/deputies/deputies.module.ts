import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Deputy } from '../votes/deputy.entity';
import { OfficialVote } from '../votes/official-vote.entity';
import { Citizen } from '../users/citizen.entity';
import { DeputiesController } from './deputies.controller';
import { DeputiesService } from './deputies.service';

@Module({
    imports: [TypeOrmModule.forFeature([Deputy, OfficialVote, Citizen])],
    controllers: [DeputiesController],
    providers: [DeputiesService],
    exports: [DeputiesService],
})
export class DeputiesModule {}
