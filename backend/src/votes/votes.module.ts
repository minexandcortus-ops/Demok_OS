import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VotesService } from './votes.service';
import { VotesController } from './votes.controller';
import { AnonymityMigrationService } from './anonymity-migration.service';
import { ConfigModule } from '@nestjs/config';
import { Vote } from './vote.entity';
import { VoteRegistry } from './vote-registry.entity';
import { VoteUrna } from './vote-choice.entity';
import { Deputy } from './deputy.entity';
import { OfficialVote } from './official-vote.entity';
import { Law } from '../laws/law.entity';
import { LawFavorite } from '../laws/law-favorite.entity';
import { Citizen } from '../users/citizen.entity';


@Module({
    imports: [
        TypeOrmModule.forFeature([Vote, VoteRegistry, VoteUrna, Deputy, OfficialVote, Law, Citizen, LawFavorite]),
        ConfigModule,
    ],
    controllers: [VotesController],
    providers: [VotesService, AnonymityMigrationService],
    exports: [VotesService],
})
export class VotesModule {
    constructor(private readonly migrationService: AnonymityMigrationService) { }
}
