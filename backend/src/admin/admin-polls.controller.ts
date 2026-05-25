import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TopicPoll } from '../surveys/topic-poll.entity';
import { AdminKeyGuard } from './admin-key.guard';

@UseGuards(AdminKeyGuard)
@Controller('admin/polls')
export class AdminPollsController {
    constructor(
        @InjectRepository(TopicPoll)
        private readonly pollRepository: Repository<TopicPoll>,
    ) {}

    /**
     * GET /admin/polls
     * Récupère tous les sondages (actifs et clôturés)
     */
    @Get()
    async getPolls() {
        const polls = await this.pollRepository.find({
            order: { createdAt: 'DESC' },
        });

        return {
            total: polls.length,
            polls: polls.map(p => ({
                id: p.id,
                slug: p.slug,
                question: p.question,
                description: p.description,
                isActive: p.isActive,
                totalVotes: p.votePour + p.voteNeutre + p.voteContre,
                createdAt: p.createdAt,
            })),
        };
    }

    /**
     * PATCH /admin/polls/:id/close
     * Clôture un sondage (passe isActive à false)
     */
    @Patch(':id/close')
    async closePoll(@Param('id') id: string) {
        const poll = await this.pollRepository.findOne({ where: { id } });
        if (!poll) return { success: false, message: 'Sondage introuvable' };

        poll.isActive = false;
        await this.pollRepository.save(poll);

        return {
            success: true,
            message: `Sondage "${poll.question}" clôturé.`,
            poll: { id: poll.id, question: poll.question, isActive: poll.isActive },
        };
    }

    /**
     * PATCH /admin/polls/:id/reopen
     * Réouvre un sondage (passe isActive à true)
     */
    @Patch(':id/reopen')
    async reopenPoll(@Param('id') id: string) {
        const poll = await this.pollRepository.findOne({ where: { id } });
        if (!poll) return { success: false, message: 'Sondage introuvable' };

        poll.isActive = true;
        await this.pollRepository.save(poll);

        return {
            success: true,
            message: `Sondage "${poll.question}" réouvert.`,
            poll: { id: poll.id, question: poll.question, isActive: poll.isActive },
        };
    }

    /**
     * POST /admin/polls
     * Crée un nouveau sondage d'actualité
     */
    @Post()
    async createPoll(
        @Body() body: { question: string; description: string; slug?: string },
    ) {
        if (!body.question || !body.description) {
            return { success: false, message: 'Le titre et le sous-titre sont requis.' };
        }

        // Auto-generate slug from question if not provided
        const slug = body.slug
            ? body.slug
            : body.question
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '')
                .substring(0, 80)
                + '-' + Date.now();

        // Check uniqueness
        const existing = await this.pollRepository.findOne({ where: { slug } });
        if (existing) {
            return { success: false, message: 'Un sondage avec ce slug existe déjà.' };
        }

        const poll = this.pollRepository.create({
            slug,
            question: body.question,
            description: body.description,
            votePour: 0,
            voteNeutre: 0,
            voteContre: 0,
            voters: '',
            isActive: true,
        });

        await this.pollRepository.save(poll);

        return {
            success: true,
            message: `Sondage "${poll.question}" créé avec succès.`,
            poll: { id: poll.id, slug: poll.slug, question: poll.question, isActive: poll.isActive },
        };
    }
}
