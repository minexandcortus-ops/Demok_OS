import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { IngestionHtmlAgendaService } from '../ingestion/ingestion-html-agenda.service';
import { SummaryUpdaterService } from '../ingestion/summary-updater.service';
import { DeputyVoteIngestionService } from '../ingestion/deputy-vote-ingestion.service';
import { AmendementIngestionService } from '../ingestion/amendement-ingestion.service';
import { DocumentIngestionService } from '../ingestion/document-ingestion.service';

@Injectable()
export class IngestionSchedulerService {
    private readonly logger = new Logger(IngestionSchedulerService.name);

    constructor(
        private ingestionHtmlAgendaService: IngestionHtmlAgendaService,
        private summaryUpdaterService: SummaryUpdaterService,
        private deputyVoteIngestionService: DeputyVoteIngestionService,
        private amendementIngestionService: AmendementIngestionService,
        private documentIngestionService: DocumentIngestionService,
    ) { }

    /**
     * Cron job optimisé : Tous les jours à 3h du matin
     * 1. Synchronise les 21 lois à l'ordre du jour (HTML scraping)
     * 2. Résout les lois dont la date est passée (votes des députés)
     * 3. Génère les résumés Mistral UNIQUEMENT pour les nouvelles lois
     */
    @Cron('0 3 * * *') // Every day at 3 AM
    async handleDailySync() {
        this.logger.log('⏰ Déclenchement du cron daily : synchronisation complète');

        try {
            // Étape 0 : Sanitisation auto-réparatrice des données corrompues
            this.logger.log('🧹 Étape 0/5 : Sanitisation des données corrompues...');
            const sanitizeResult = await this.summaryUpdaterService.sanitizeBadData();
            if (sanitizeResult.fixed > 0) {
                this.logger.warn(`⚠️ ${sanitizeResult.fixed} loi(s) corrigée(s) par la sanitisation !`);
            }

            // Étape 1 : Synchronisation HTML (21 lois à l'ordre du jour)
            this.logger.log('📥 Étape 1/5 : Synchronisation HTML des lois à l\'ordre du jour...');
            const syncResult = await this.ingestionHtmlAgendaService.syncFromHtml();
            this.logger.log(`✅ Sync terminée : ${syncResult.updated || 0} lois à l'agenda, ${syncResult.imported || 0} importées`);

            // Étape 2 : Résolution des votes des députés (lois dont la date est passée)
            this.logger.log('🗳️ Étape 2/5 : Résolution des votes des députés...');
            const voteResult = await this.deputyVoteIngestionService.syncDeputyVotes();
            this.logger.log(`✅ Votes résolus : ${voteResult.resolved} lois résolues, ${voteResult.skipped} en attente`);

            // Étape 3 : Génération Mistral OPTIMISÉE (seulement lois sans résumé)
            this.logger.log('🤖 Étape 3/5 : Génération résumés IA pour nouvelles lois...');
            const mistralResult = await this.summaryUpdaterService.updateRecentSummaries();
            this.logger.log(`✅ Mistral terminé : ${mistralResult.processed} lois traitées, ${mistralResult.skipped} ignorées`);

            // Étape 4 : Re-sync des amendements pour toutes les lois à l'agenda
            // (fire-and-forget : ne bloque pas le retour du cron si Mistral est lent)
            this.logger.log('📋 Étape 4/5 : Re-sync amendements CSV pour les lois à l\'agenda...');
            this.amendementIngestionService.ingestAllOnAgendaLaws().catch(e =>
                this.logger.error('❌ Erreur amendements CRON : ' + e.message)
            );

            // Étape 5 : Récupération du dernier texte en date (PDF/HTML)
            this.logger.log('📄 Étape 5/5 : Mise à jour des liens vers les derniers textes...');
            const docsResult = await this.documentIngestionService.updateLatestTexts();
            this.logger.log(`✅ Textes actualisés : ${docsResult.updated} loi(s) mise(s) à jour`);

            this.logger.log('🎉 Cron daily terminé avec succès !');
        } catch (error) {
            this.logger.error('❌ Erreur dans le cron job daily', error.stack);
        }
    }
}
