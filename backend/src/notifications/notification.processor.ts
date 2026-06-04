import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { NotificationService } from './notification.service';

/**
 * Processor pour traiter les notifications dans la queue Redis
 */
@Processor('notifications')
export class NotificationProcessor {
    private readonly logger = new Logger(NotificationProcessor.name);

    constructor(
        @InjectRepository(User)
        private userRepository: Repository<User>,
        private notificationService: NotificationService,
    ) {}

    /**
     * Traite les notifications de modification de loi
     */
    @Process('law-modified')
    async handleLawModified(job: Job) {
        const { userId, lawId, lawTitle, message } = job.data;

        this.logger.log(`📬 Traitement notification pour user ${userId}`);

        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (user && user.fcmToken && user.notifyLawResults) {
            await this.notificationService.sendPushNotification(
                user.fcmToken,
                'Loi modifiée',
                message,
                { type: 'LAW_MODIFIED', lawId }
            );
        }

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
     * Traite les notifications de résultat de vote d'une loi
     */
    @Process('law-voted')
    async handleLawVoted(job: Job) {
        const { lawId, lawTitle, resultStats, adopted } = job.data;
        this.logger.log(`📬 Traitement résultat loi votée: ${lawTitle}`);

        // Get all users who want law results notifications
        const users = await this.userRepository.find({
            where: { notifyLawResults: true }
        });

        const tokens = users.map(u => u.fcmToken).filter(t => !!t);

        if (tokens.length > 0) {
            const title = adopted ? "🏛️ Loi adoptée !" : "🏛️ Loi rejetée !";
            const pour = resultStats?.pour || 0;
            const contre = resultStats?.contre || 0;
            const total = (pour + contre) > 0 ? (pour + contre) : 1;
            const pourPercent = Math.round((pour / total) * 100);
            const contrePercent = Math.round((contre / total) * 100);
            
            const message = `L'Assemblée a voté la loi "${lawTitle}" (Pour: ${pourPercent}%, Contre: ${contrePercent}%).`;

            await this.notificationService.sendMulticast(
                tokens,
                title,
                message,
                { type: 'LAW_MODIFIED', lawId: String(lawId) }
            );
        }
    }

    /**
     * Traite les notifications de nouveau sondage
     */
    @Process('new-survey')
    async handleNewSurvey(job: Job) {
        const { pollId, question } = job.data;
        this.logger.log(`📬 Traitement nouveau sondage: ${question}`);

        // Get all users who want new survey notifications
        const users = await this.userRepository.find({
            where: { notifyNewSurveys: true }
        });

        const tokens = users.map(u => u.fcmToken).filter(t => !!t);

        if (tokens.length > 0) {
            await this.notificationService.sendMulticast(
                tokens,
                'Nouveau Sondage',
                `Un nouveau sondage est disponible : "${question}"`,
                { type: 'NEW_SURVEY', pollId: String(pollId) }
            );
        }
    }

    /**
     * Traite les notifications de sondage clôturé
     */
    @Process('survey-closed')
    async handleSurveyClosed(job: Job) {
        const { pollId, question, voterIds } = job.data;
        this.logger.log(`📬 Traitement sondage clôturé: ${question}`);

        if (!voterIds || voterIds.length === 0) return;

        const users = await this.userRepository.createQueryBuilder('user')
            .where('user.id IN (:...ids)', { ids: voterIds })
            .andWhere('user.notifySurveyResults = :val', { val: true })
            .getMany();

        const tokens = users.map(u => u.fcmToken).filter(t => !!t);

        if (tokens.length > 0) {
            await this.notificationService.sendMulticast(
                tokens,
                'Résultats du sondage',
                `Le sondage auquel vous avez participé est clôturé : "${question}"`,
                { type: 'SURVEY_CLOSED', pollId: String(pollId) }
            );
        }
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
