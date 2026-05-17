import { Controller, Post, Get, Body, Param, Query, UseGuards } from '@nestjs/common';
import { VotesService } from './votes.service';
import { VoteDto } from './dto/vote.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/get-user.decorator';
import { User } from '../users/user.entity';

@Controller('votes')
export class VotesController {
    constructor(private readonly votesService: VotesService) { }

    /**
     * Endpoint to cast a vote.
     * Uses JWT authentication.
     */
    @Post()
    @UseGuards(JwtAuthGuard)
    async vote(@CurrentUser() user: User, @Body() dto: VoteDto) {
        return this.votesService.castVote(user.id, dto);
    }

    /**
     * Toggles favorite status for a law.
     */
    @Post('laws/:lawId/favorite')
    @UseGuards(JwtAuthGuard)
    async toggleFavorite(
        @CurrentUser() user: User,
        @Param('lawId') lawId: string,
    ) {
        return this.votesService.toggleFavorite(user.id, lawId);
    }

    /**
     * Gets a list of law IDs that the user has favorited.
     */
    @Get('laws/favorites/ids')
    @UseGuards(JwtAuthGuard)
    async getFavoriteLawIds(
        @CurrentUser() user: User,
    ) {
        return this.votesService.getFavoriteLawIds(user.id);
    }

    /**
     * Retrieves the laws feed with optional filtering.
     * Identification is optional via JWT.
     */
    @Get('laws')
    @UseGuards(OptionalJwtAuthGuard)
    async getLaws(
        @CurrentUser() user?: User,
        @Query('categories') categories?: string,
        @Query('q') query?: string,
        @Query('region') region?: string,
        @Query('status') status?: string,
        @Query('sortBy') sortBy?: 'ASC' | 'DESC',
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 10,
        @Query('votedOnly') votedOnly?: string,
    ) {
        const categoryIds = categories ? categories.split(',').map(Number) : [];
        return this.votesService.getLawsFeed(categoryIds, query, region, status, user?.id, sortBy, page, limit, votedOnly);
    }

    /**
     * Checks if a user has voted on a law and returns context (stats, deputy match).
     */
    @Get('check')
    @UseGuards(OptionalJwtAuthGuard)
    async checkVote(
        @CurrentUser() user?: User,
        @Query('lawId') lawId?: string,
    ) {
        if (!user || !lawId) return { hasVoted: false };
        return this.votesService.checkVote(user.id, lawId);
    }
}
