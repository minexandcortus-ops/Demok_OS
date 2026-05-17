import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { DebatesService } from './debates.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/get-user.decorator';
import { User } from '../users/user.entity';

@Controller('debates')
export class DebatesController {
    constructor(private readonly debatesService: DebatesService) { }

    /**
     * GET /debates/active-laws
     * Retourne les lois les plus actives dans les débats (classées par nb d'opinions)
     */
    @Get('active-laws')
    @UseGuards(OptionalJwtAuthGuard)
    async getActiveLaws(
        @Query('limit') limit?: string,
    ) {
        const take = limit ? parseInt(limit, 10) : 20;
        return this.debatesService.getActiveLaws(take);
    }

    @Get('opinions')
    @UseGuards(OptionalJwtAuthGuard)
    async getOpinions(
        @Query('lawId') lawId: string,
        @Query('sort') sort: 'recent' | 'popular',
        @CurrentUser() user?: User,
    ) {
        return this.debatesService.getOpinions(lawId, user?.id, sort);
    }

    @Post('opinions')
    @UseGuards(JwtAuthGuard)
    async createOpinion(
        @Body() body: { lawId: string; content: string },
        @CurrentUser() user: User
    ) {
        return this.debatesService.createOpinion(user.id, body.lawId, body.content);
    }

    @Post('opinions/:id/moke')
    @UseGuards(JwtAuthGuard)
    async toggleMoke(
        @Param('id') opinionId: string,
        @CurrentUser() user: User
    ) {
        return this.debatesService.toggleMoke(user.id, opinionId);
    }

    @Patch('opinions/:id')
    @UseGuards(JwtAuthGuard)
    async updateOpinion(
        @Param('id') opinionId: string,
        @Body() body: { content: string },
        @CurrentUser() user: User
    ) {
        return this.debatesService.updateOpinion(user.id, opinionId, body.content);
    }

    @Post('opinions/:id/report')
    @UseGuards(JwtAuthGuard)
    async reportOpinion(
        @Param('id') opinionId: string,
        @CurrentUser() user: User,
        @Body() body: { reason?: string }
    ) {
        return this.debatesService.reportOpinion(user.id, opinionId, body.reason);
    }
}
