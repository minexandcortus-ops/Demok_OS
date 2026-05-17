import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

/**
 * Processor pour traiter les notifications dans la queue Redis
 * PHASE 3 : Logs uniquement (pas de vraies push notifications)
 */
@Processor('notifications')
export class NotificationProcessor {
    private readonly logger = new Logger(NotificationProcessor.name);

    /**
     * Traite les notifications de modification de loi
     */
    @Process('law-modified')
    async handleLawModified(job: Job) {
        const { userId, lawId, lawTitle, message } = job.data;

        this.logger.log(`📬 Traitement notification pour user ${userId}`);
        this.logger.log(`   📜 Loi: ${lawTitle} (ID: ${lawId})`);
        this.logger.log(`   💬 Message: ${message}`);

        // PHASE 3 : Logs uniquement
        // PHASE 4 : Envoyer vraie push notification (Firebase/OneSignal)

        // Simuler un délai de traitement
        await new Promise(resolve => setTimeout(resolve, 100));

        this.logger.log(`✅ Notification traitée pour user ${userId}`);

        return {
            success: true,
            userId,
            lawId,
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Traite les notifications génériques
     */
    @Process('generic')
    async handleGenericNotification(job: Job) {
        const { userId, title, body, data } = job.data;

        this.logger.log(`📬 Notification générique pour user ${userId}`);
        this.logger.log(`   📌 Titre: ${title}`);
        this.logger.log(`   📝 Corps: ${body}`);

        // PHASE 3 : Logs uniquement

        await new Promise(resolve => setTimeout(resolve, 100));

        this.logger.log(`✅ Notification générique traitée`);

        return {
            success: true,
            userId,
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Gestion des erreurs
     */
    @Process()
    async handleError(job: Job) {
        this.logger.error(`❌ Erreur lors du traitement du job ${job.id}`);
        this.logger.error(`   Type: ${job.name}`);
        this.logger.error(`   Data: ${JSON.stringify(job.data)}`);

        throw new Error(`Failed to process job ${job.id}`);
    }
}
