import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { GroupVotesService } from './group-votes.service';

@Controller('votes')
export class GroupVotesController {
    constructor(private readonly groupVotesService: GroupVotesService) { }

    /** Vote de chaque groupe politique de l'Assemblée sur une loi, avec les frondeurs. */
    @Get('laws/:lawId/groups')
    async getGroupVotes(@Param('lawId', new ParseUUIDPipe()) lawId: string) {
        return this.groupVotesService.getForLaw(lawId);
    }
}
