import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TopicPoll } from '../surveys/topic-poll.entity';
import { AdminKeyGuard } from './admin-key.guard';
import { NotificationService } from '../notifications/notification.service';

@UseGuards(AdminKeyGuard)
@Controller('admin/polls')
export class AdminPollsController {
    constructor(
        @InjectRepository(TopicPoll)
        private readonly pollRepository: Repository<TopicPoll>,
        private readonly notificationService: NotificationService,
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

        const urnaRepo = this.pollRepository.manager.getRepository('SurveyUrna');

        return {
            total: polls.length,
            polls: await Promise.all(polls.map(async p => {
                const newVotesCount = await urnaRepo.count({ where: { surveyId: p.id } });
                const legacyVotes = p.votePour + p.voteNeutre + p.voteContre;

                return {
                    id: p.id,
                    slug: p.slug,
                    question: p.question,
                    description: p.description,
                    isActive: p.isActive,
                    totalVotes: legacyVotes + newVotesCount,
                    createdAt: p.createdAt,
                };
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

        // Récupérer les voters : legacy (ids en string) + nouveau système SurveyRegistry
        const legacyVoterIds = poll.voters ? poll.voters.split(',').filter(v => v.length > 0) : [];

        const registryRepo = this.pollRepository.manager.getRepository('SurveyRegistry');
        const registries = await registryRepo.find({
            where: { surveyId: poll.id },
            relations: ['citizen', 'citizen.user'],
        });
        const newVoterIds = registries
            .map((r: any) => r.citizen?.user?.id)
            .filter((id: any) => id !== undefined && id !== null);

        const voterIds = [...new Set([...legacyVoterIds, ...newVoterIds])];

        // Centralisation via NotificationService (au lieu d'injecter la queue directement)
        await this.notificationService.notifySurveyClosed(poll.id, poll.question, voterIds);

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

        // Auto-génération du slug si non fourni
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

        // Centralisation via NotificationService
        await this.notificationService.notifyNewSurvey(poll.id, poll.question);

        return {
            success: true,
            message: `Sondage "${poll.question}" créé avec succès.`,
            poll: { id: poll.id, slug: poll.slug, question: poll.question, isActive: poll.isActive },
        };
    }
}
