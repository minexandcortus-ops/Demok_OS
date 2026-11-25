import { Controller, Get, Post, Param, Body, UseGuards, ParseEnumPipe } from '@nestjs/common';
import { TopicPollService } from './topic-poll.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/get-user.decorator';
import { User } from '../users/user.entity';

export enum TopicPollChoice {
    POUR = 'pour',
    NEUTRE = 'neutre',
    CONTRE = 'contre',
}

@Controller('surveys/polls')
export class TopicPollController {
    constructor(private readonly service: TopicPollService) { }

    @Get()
    async getPolls() {
        return this.service.getPolls();
    }

    @Get(':slug')
    async getPoll(@Param('slug') slug: string) {
        return this.service.getPoll(slug);
    }

    @Get(':slug/has-voted')
    @UseGuards(JwtAuthGuard)
    async hasVoted(
        @Param('slug') slug: string,
        @CurrentUser() user: User,
    ) {
        return { hasVoted: await this.service.hasVoted(slug, user.id) };
    }

    @Post(':slug/vote')
    @UseGuards(JwtAuthGuard)
    async vote(
        @Param('slug') slug: string,
        @CurrentUser() user: User,
        @Body('choice', new ParseEnumPipe(TopicPollChoice)) choice: TopicPollChoice,
    ) {
        return this.service.vote(slug, user.id, choice);
    }
}
