import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GroupVote } from './group-vote.entity';
import { Deputy } from './deputy.entity';
import { OfficialVote } from './official-vote.entity';
import { GroupVotesService } from './group-votes.service';
import { GroupVotesController } from './group-votes.controller';

@Module({
    imports: [TypeOrmModule.forFeature([GroupVote, Deputy, OfficialVote])],
    controllers: [GroupVotesController],
    providers: [GroupVotesService],
    exports: [GroupVotesService],
})
export class GroupVotesModule { }
