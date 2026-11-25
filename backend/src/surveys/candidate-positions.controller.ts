import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { CandidatePositionsService } from './candidate-positions.service';

@Controller()
export class CandidatePositionsController {
    constructor(private readonly service: CandidatePositionsService) { }

    /** Position de chaque candidat à la présidentielle sur une loi (sourcée). */
    @Get('votes/laws/:lawId/candidate-positions')
    async forLaw(@Param('lawId', new ParseUUIDPipe()) lawId: string) {
        return this.service.getForLaw(lawId);
    }

    /** Positions connues d'un candidat, loi par loi. */
    @Get('surveys/presidential/candidates/:id/positions')
    async forCandidate(@Param('id', new ParseUUIDPipe()) id: string) {
        return this.service.getForCandidate(id);
    }
}
