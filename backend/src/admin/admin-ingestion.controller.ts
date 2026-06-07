import { Controller, Post, Get, Logger, Query, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import { Law } from '../laws/law.entity';
import { Amendement } from '../laws/amendement.entity';
import { IngestionHtmlAgendaService } from '../ingestion/ingestion-html-agenda.service';
import { SummaryUpdaterService } from '../ingestion/summary-updater.service';
import { DynScraperService } from '../ingestion/dyn-scraper.service';
import { DeputySyncService } from '../ingestion/deputy-sync.service';
import { DeputyVoteIngestionService } from '../ingestion/deputy-vote-ingestion.service';
import { AmendementIngestionService } from '../ingestion/amendement-ingestion.service';
import { DocumentIngestionService } from '../ingestion/document-ingestion.service';
import { IngestionANService } from '../ingestion/ingestion-an.service';
import { AdminKeyGuard } from './admin-key.guard';

@UseGuards(AdminKeyGuard)
@Controller('admin/ingestion')
export class AdminIngestionController {
    private readonly logger = new Logger(AdminIngestionController.name);

    constructor(
        private ingestionHtmlAgendaService: IngestionHtmlAgendaService,
        private summaryUpdaterService: SummaryUpdaterService,
        private deputyVoteIngestionService: DeputyVoteIngestionService,
        private amendementIngestionService: AmendementIngestionService,
        private readonly ingestionAnService: IngestionANService,
        private readonly deputySyncService: DeputySyncService,
        private documentIngestionService: DocumentIngestionService,
        @InjectRepository(Law)
        private lawRepository: Repository<Law>,
        @InjectRepository(Amendement)
        private amendementRepository: Repository<Amendement>,
    ) { }

    /**
     * POST /admin/ingestion/agenda/sync-html
     * Synchronise depuis le site HTML officiel (scraping)
     */
    @Post('agenda/sync-html')
    async syncHtmlAgenda() {
        this.logger.log('🌐 Déclenchement manuel de la synchronisation HTML');
        try {
            const result = await this.ingestionHtmlAgendaService.syncFromHtml();
            return { success: true, message: 'Synchronisation HTML terminée', details: result, timestamp: new Date().toISOString() };
        } catch (error) {
            this.logger.error('Erreur lors de la synchronisation HTML', error);
            return { success: false, message: error.message, timestamp: new Date().toISOString() };
        }
    }

    /**
     * POST /admin/ingestion/deputy-votes/sync
     * Déclenche manuellement la résolution des votes des députés.
     * Résout les lois dont la date est passée et récupère les scrutins AN.
     */
    @Post('deputy-votes/sync')
    async syncDeputyVotes(@Query('force') force: string) {
        const isForce = force === 'true';
        this.logger.log(`🗳️ Déclenchement manuel de la synchronisation des votes des députés (Force: ${isForce})`);

        // Exécution en arrière-plan pour éviter le timeout nginx (synchro ~2-3 min)
        this.deputyVoteIngestionService.syncDeputyVotes(isForce)
            .then(result => {
                this.logger.log(`✅ Sync votes terminée : ${result.resolved} résolues, ${result.skipped} en attente, ${result.errors} erreurs`);
            })
            .catch(error => {
                this.logger.error('Erreur lors de la synchronisation des votes (arrière-plan)', error);
            });

        return {
            success: true,
            message: `Synchronisation des votes lancée en arrière-plan (force: ${isForce}). Consultez les logs du serveur pour le résultat.`,
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * POST /admin/ingestion/texts/sync
     * Déclenche manuellement la recherche des derniers textes de loi.
     */
    @Post('texts/sync')
    async syncLatestTexts() {
        this.logger.log('📄 Déclenchement manuel : MàJ des derniers textes');
        try {
            const result = await this.documentIngestionService.updateLatestTexts();
            return {
                success: true,
                message: `Mise à jour terminée : ${result.updated} textes trouvés/actualisés, ${result.errors} erreurs`,
                details: result,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            this.logger.error('Erreur lors de la mise à jour des textes', error);
            return { success: false, message: error.message, timestamp: new Date().toISOString() };
        }
    }

    /**
     * POST /admin/ingestion/update-all-summaries
     * Met à jour tous les résumés et titres vulgarisés via Mistral AI
     */
    @Post('update-all-summaries')
    async updateAllSummaries() {
        this.logger.log('🤖 Déclenchement de la mise à jour Mistral pour toutes les lois');
        try {
            const allLaws = await this.lawRepository.find();
            let successCount = 0;
            let errorCount = 0;
            for (const law of allLaws) {
                try {
                    await this.summaryUpdaterService.updateSummary(law);
                    successCount++;
                } catch (error) {
                    this.logger.error(`Erreur sur ${law.externalId}: ${error.message}`);
                    errorCount++;
                }
            }
            return {
                success: true,
                message: `Mise à jour terminée : ${successCount} réussies, ${errorCount} erreurs`,
                totalLaws: allLaws.length,
                successCount,
                errorCount,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            this.logger.error('Erreur lors de la mise à jour des résumés', error);
            return { success: false, message: error.message, timestamp: new Date().toISOString() };
        }
    }

    /**
     * POST /admin/ingestion/amendements/sync
     * Déclenche manuellement la re-sync des amendements pour toutes les lois à l'agenda
     */
    @Post('amendements/sync')
    async syncAmendements() {
        this.logger.log('📋 Déclenchement manuel de la sync amendements');
        try {
            await this.amendementIngestionService.ingestAllOnAgendaLaws();
            return { success: true, message: 'Sync amendements déclenchée (en arrière-plan)', timestamp: new Date().toISOString() };
        } catch (error) {
            this.logger.error('Erreur sync amendements', error);
            return { success: false, message: error.message, timestamp: new Date().toISOString() };
        }
    }

    /**
     * GET /admin/ingestion/stats
     */
    @Get('stats')
    async getStats() {
        const totalLaws = await this.lawRepository.count();
        const ingestedLaws = await this.lawRepository.count({ where: [{ externalId: Not(IsNull()) }] });
        const recentLaws = await this.lawRepository.find({
            where: { externalId: Not(IsNull()) },
            order: { id: 'DESC' },
            take: 5,
            select: ['id', 'externalId', 'titleOfficial', 'status', 'currentSource', 'navetteStatus', 'modificationCount'],
        });
        const totalAmendements = await this.amendementRepository.count();
        return { totalLaws, ingestedLaws, totalAmendements, recentIngestions: recentLaws, timestamp: new Date().toISOString() };
    }

    @Post('deputies')
    async syncDeputies() {
        this.deputySyncService.syncDeputiesFromNosDeputes();
        return { success: true, message: 'Synchronisation des députés lancée en arrière-plan' };
    }
}
