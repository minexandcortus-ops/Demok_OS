import { Controller, Get, Post, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { SurveysService } from './surveys.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/get-user.decorator';
import { User } from '../users/user.entity';

@Controller('surveys')
export class SurveysController {
    constructor(private readonly surveysService: SurveysService) { }

    /**
     * Get all presidential candidates
     */
    @Get('presidential/candidates')
    async getCandidates() {
        return this.surveysService.getCandidates();
    }

    /**
     * Vote for a presidential candidate
     */
    @Post('presidential/vote')
    @UseGuards(JwtAuthGuard)
    async vote(
        @CurrentUser() user: User,
        @Body('candidateId') candidateId: string
    ) {
        if (!candidateId) {
            throw new BadRequestException('Candidate ID required');
        }

        try {
            return await this.surveysService.vote(user.id, candidateId);
        } catch (error) {
            throw new BadRequestException(error.message);
        }
    }

    /**
     * Get voting results
     */
    @Get('presidential/results')
    async getResults() {
        return this.surveysService.getResults();
    }

    /**
     * Check if user has voted
     */
    @Get('presidential/has-voted')
    @UseGuards(JwtAuthGuard)
    async hasVoted(@CurrentUser() user: User) {
        const hasVoted = await this.surveysService.hasVoted(user.id);
        return { hasVoted };
    }
}
