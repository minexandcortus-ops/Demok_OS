import { Controller, Get, Patch, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { ReportsService } from '../reports/reports.service';
import { Report, ReportStatus, ReportCategory } from '../reports/entities/report.entity';
import { Law, LawStatus } from '../laws/law.entity';
import { OpinionReport } from '../debates/entities/opinion-report.entity';
import { AdminKeyGuard } from './admin-key.guard';
import { NotificationService } from '../notifications/notification.service';

import { Citizen } from '../users/citizen.entity';
import { VoteUrna } from '../votes/vote-choice.entity';

@UseGuards(AdminKeyGuard)
@Controller('admin/reports')
export class AdminReportsController {
    constructor(
        private readonly reportsService: ReportsService,
        @InjectRepository(Law)
        private readonly lawRepository: Repository<Law>,
        @InjectRepository(OpinionReport)
        private readonly opinionReportRepository: Repository<OpinionReport>,
        @InjectRepository(Citizen)
        private readonly citizenRepository: Repository<Citizen>,
        @InjectRepository(VoteUrna)
        private readonly voteUrnaRepository: Repository<VoteUrna>,
    ) {}

    /**
     * GET /admin/reports
     * Récupère tous les signalements, filtrable par statut
     */
    @Get()
    async getReports(
        @Query('status') status?: ReportStatus,
    ) {
        // 1. Fetch general reports
        const reports = await this.reportsService.findAll(status);
        
        // 2. Fetch opinion reports
        let mergedReports = [...reports];
        
        if (!status || status === ReportStatus.PENDING) {
            const opinionReports = await this.opinionReportRepository.find({
                relations: ['opinion', 'opinion.law'],
                order: { createdAt: 'DESC' }
            });
            
            const mappedOpinionReports = opinionReports.map(or => ({
                id: or.id,
                lawId: or.opinion?.lawId || 'N/A',
                userId: or.userId,
                category: 'ARGUMENT' as any,
                description: `[SIGNALEMENT AVIS] Commentaire de l'utilisateur: "${or.opinion?.content || 'Contenu inconnu'}"`,
                status: ReportStatus.PENDING,
                createdAt: or.createdAt,
                isOpinionReport: true,
                opinionId: or.opinionId
            }));
            
            mergedReports = [...mappedOpinionReports, ...reports];
            mergedReports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }

        // 3. Count global stats
        const usersCount = await this.citizenRepository.count();
        const lawsCount = await this.lawRepository.count();
        const votesCount = await this.voteUrnaRepository.count();

        return {
            total: mergedReports.length,
            reports: mergedReports,
            usersCount,
            lawsCount,
            votesCount,
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * PATCH /admin/reports/:id/status
     * Met à jour le statut d'un signalement
     */
    @Patch(':id/status')
    async updateReportStatus(
        @Param('id') id: string,
        @Query('status') status: ReportStatus,
    ) {
        const report = await this.reportsService.updateStatus(id, status);
        return { success: true, report };
    }
}

@UseGuards(AdminKeyGuard)
@Controller('admin/laws')
export class AdminLawsController {
    constructor(
        @InjectRepository(Law)
        private readonly lawRepository: Repository<Law>,
        private readonly notificationService: NotificationService,
    ) {}

    /**
     * GET /admin/laws?q=...&status=PENDING
     * Recherche des lois par titre, filtrable par statut
     */
    @Get()
    async searchLaws(
        @Query('q') q?: string,
        @Query('status') status?: LawStatus,
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
    ) {
        let where: any = {};
        if (status) where.status = status;

        if (q) {
            where = [
                { ...where, titleVulgarized: ILike(`%${q}%`) },
                { ...where, titleOfficial: ILike(`%${q}%`) }
            ];
        }

        const take = limit ? parseInt(limit, 10) : 20;
        const skip = offset ? parseInt(offset, 10) : 0;

        const [laws, total] = await this.lawRepository.findAndCount({
            where,
            select: ['id', 'externalId', 'titleOfficial', 'titleVulgarized', 'status', 'voteDate', 'deputyVoteResult', 'officialUrl'],
            order: { voteDate: { direction: 'DESC', nulls: 'LAST' }, id: 'ASC' },
            take,
            skip,
        });

        return { total, laws, count: laws.length };
    }

    /**
     * PATCH /admin/laws/:id/status
     * Passe définitivement une loi au statut VALIDATED ou REJECTED
     */
    @Patch(':id/status')
    async updateLawStatus(
        @Param('id') id: string,
        @Body() body: { status: LawStatus },
    ) {
        const allowed = [LawStatus.VALIDATED, LawStatus.REJECTED, LawStatus.VOTED_AN, LawStatus.AT_SENATE];
        if (!allowed.includes(body.status)) {
            return { success: false, message: `Statut '${body.status}' non autorisé via l'admin. Valeurs autorisées : ${allowed.join(', ')}` };
        }

        const law = await this.lawRepository.findOne({ where: { id } });
        if (!law) return { success: false, message: 'Loi introuvable' };

        const previousStatus = law.status;
        law.status = body.status;
        await this.lawRepository.save(law);

        return {
            success: true,
            message: `Loi mise à jour : ${previousStatus} → ${body.status}`,
            law: { id: law.id, title: law.titleVulgarized || law.titleOfficial, status: law.status },
        };
    }

    /**
     * PATCH /admin/laws/:id/vote-result
     * Modifie manuellement le résultat du vote
     */
    @Patch(':id/vote-result')
    async updateVoteResult(
        @Param('id') id: string,
        @Body() body: { 
            pour?: number; 
            contre?: number; 
            abstention?: number; 
            isMainLevee?: boolean;
        },
    ) {
        const law = await this.lawRepository.findOne({ where: { id } });
        if (!law) return { success: false, message: 'Loi introuvable' };

        if (!law.deputyVoteResult) {
            law.deputyVoteResult = {
                pour: 0,
                contre: 0,
                abstention: 0,
                nonVotants: 0,
                total: 0,
                adopted: law.status === LawStatus.VALIDATED,
            };
        }

        if (body.isMainLevee !== undefined) {
            law.deputyVoteResult.isMainLevee = body.isMainLevee;
            if (body.isMainLevee) {
                law.deputyVoteResult.voteType = 'main_levee';
            }
        }

        if (body.pour !== undefined) law.deputyVoteResult.pour = body.pour;
        if (body.contre !== undefined) law.deputyVoteResult.contre = body.contre;
        if (body.abstention !== undefined) law.deputyVoteResult.abstention = body.abstention;
        
        law.deputyVoteResult.total = (law.deputyVoteResult.pour || 0) + (law.deputyVoteResult.contre || 0) + (law.deputyVoteResult.abstention || 0);
        
        if (!law.deputyVoteResult.isMainLevee) {
            law.deputyVoteResult.adopted = law.deputyVoteResult.pour > law.deputyVoteResult.contre;
            law.deputyVoteResult.voteType = 'scrutin_public';
        } else {
            law.deputyVoteResult.adopted = true;
        }

        await this.lawRepository.save(law);

        return {
            success: true,
            message: 'Résultat du vote mis à jour',
            voteResult: law.deputyVoteResult,
        };
    }
    /**
     * PATCH /admin/laws/:id/official-url
     * Modifie manuellement le lien de la loi
     */
    @Patch(':id/official-url')
    async updateOfficialUrl(
        @Param('id') id: string,
        @Body() body: { officialUrl: string },
    ) {
        const law = await this.lawRepository.findOne({ where: { id } });
        if (!law) return { success: false, message: 'Loi introuvable' };

        law.officialUrl = body.officialUrl;
        await this.lawRepository.save(law);

        return {
            success: true,
            message: 'Lien de la loi mis à jour',
            officialUrl: law.officialUrl,
        };
    }

    /**
     * POST /admin/laws/:id/notify-results
     * Envoie manuellement la notification de résultat de vote à tous les utilisateurs
     */
    @Post(':id/notify-results')
    async notifyLawResults(
        @Param('id') id: string,
    ) {
        const law = await this.lawRepository.findOne({ where: { id } });
        if (!law) return { success: false, message: 'Loi introuvable' };

        const stats = law.deputyVoteResult || { pour: 0, contre: 0, abstention: 0, adopted: false };
        const adopted = stats.adopted;

        await this.notificationService.notifyLawVoted(
            law.id,
            law.titleVulgarized || law.titleOfficial,
            stats,
            adopted
        );

        return {
            success: true,
            message: 'Notification envoyée à tous les utilisateurs.',
        };
    }
}
