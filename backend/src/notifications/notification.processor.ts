import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { NotificationService } from './notification.service';

/**
 * Processor pour traiter les notifications dans la queue Redis/Bull.
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
     * Traite les notifications de modification/résultat d'une loi.
     * Le job reçoit maintenant un tableau de tokens (multicast) au lieu d'un userId unique.
     */
    @Process('law-modified')
    async handleLawModified(job: Job) {
        const { tokens, userId, lawId, lawTitle, message } = job.data;

        // Support du nouveau format (tokens[]) et de l'ancien format (userId) pour compatibilité
        if (tokens && Array.isArray(tokens)) {
            this.logger.log(`📬 Traitement notification multicast loi modifiée (${tokens.length} destinataires)`);
            await this.notificationService.sendMulticast(
                tokens,
                'Résultat de vote',
                message,
                { type: 'LAW_MODIFIED', lawId: String(lawId) },
            );
        } else if (userId) {
            // Ancien format : un job = un utilisateur
            this.logger.log(`📬 Traitement notification individuelle pour user ${userId}`);
            const user = await this.userRepository.findOne({ where: { id: userId } });
            if (user?.fcmToken && user.notifyLawResults) {
                await this.notificationService.sendPushNotification(
                    user.fcmToken,
                    'Résultat de vote',
                    message,
                    { type: 'LAW_MODIFIED', lawId: String(lawId) },
                );
            }
        }

        this.logger.log(`✅ Job "law-modified" traité (loi: ${lawId})`);
        return { success: true, lawId, timestamp: new Date().toISOString() };
    }

    /**
     * Traite les notifications de résultat de vote d'une loi (envoyé à TOUS les abonnés).
     */
    @Process('law-voted')
    async handleLawVoted(job: Job) {
        const { lawId, lawTitle, resultStats, adopted } = job.data;
        this.logger.log(`📬 Traitement résultat loi votée : ${lawTitle}`);

        const users = await this.userRepository.find({
            where: { notifyLawResults: true },
        });

        const tokens = users.map(u => u.fcmToken).filter((t): t is string => !!t);

        if (tokens.length > 0) {
            const title = adopted ? '🏛️ Loi adoptée !' : '🏛️ Loi rejetée !';
            const pour = resultStats?.pour || 0;
            const contre = resultStats?.contre || 0;
            const total = (pour + contre) > 0 ? (pour + contre) : 1;
            const pourPercent = Math.round((pour / total) * 100);
            const contrePercent = Math.round((contre / total) * 100);

            const message = `L'Assemblée a voté la loi "${lawTitle}" (Pour: ${pourPercent}%, Contre: ${contrePercent}%).`;

            // FIX : type corrigé de 'LAW_MODIFIED' → 'LAW_VOTED'
            await this.notificationService.sendMulticast(
                tokens,
                title,
                message,
                { type: 'LAW_VOTED', lawId: String(lawId) },
            );
        }

        this.logger.log(`✅ Job "law-voted" traité pour la loi ${lawId} (${tokens.length} destinataires)`);
        return { success: true, lawId, timestamp: new Date().toISOString() };
    }

    /**
     * Traite les notifications de nouveau sondage.
     */
    @Process('new-survey')
    async handleNewSurvey(job: Job) {
        const { pollId, question } = job.data;
        this.logger.log(`📬 Traitement nouveau sondage : ${question}`);

        const users = await this.userRepository.find({
            where: { notifyNewSurveys: true },
        });

        const tokens = users.map(u => u.fcmToken).filter((t): t is string => !!t);

        if (tokens.length > 0) {
            await this.notificationService.sendMulticast(
                tokens,
                '🗳️ Nouveau Sondage',
                `Un nouveau sondage est disponible : "${question}"`,
                { type: 'NEW_SURVEY', pollId: String(pollId) },
            );
        }

        this.logger.log(`✅ Job "new-survey" traité (${tokens.length} destinataires)`);
        return { success: true, pollId, timestamp: new Date().toISOString() };
    }

    /**
     * Traite les notifications de sondage clôturé (uniquement aux participants).
     */
    @Process('survey-closed')
    async handleSurveyClosed(job: Job) {
        const { pollId, question, voterIds } = job.data;
        this.logger.log(`📬 Traitement sondage clôturé : ${question}`);

        if (!voterIds || voterIds.length === 0) return;

        const users = await this.userRepository
            .createQueryBuilder('user')
            .where('user.id IN (:...ids)', { ids: voterIds })
            .andWhere('user.notifySurveyResults = :val', { val: true })
            .andWhere('user.fcmToken IS NOT NULL')
            .getMany();

        const tokens = users.map(u => u.fcmToken).filter((t): t is string => !!t);

        if (tokens.length > 0) {
            await this.notificationService.sendMulticast(
                tokens,
                '📊 Résultats du sondage',
                `Le sondage auquel vous avez participé est clôturé : "${question}"`,
                { type: 'SURVEY_CLOSED', pollId: String(pollId) },
            );
        }

        this.logger.log(`✅ Job "survey-closed" traité (${tokens.length} destinataires)`);
        return { success: true, pollId, timestamp: new Date().toISOString() };
    }

    /**
     * Traite les notifications génériques (ex: annonces admin).
     */
    @Process('generic')
    async handleGenericNotification(job: Job) {
        const { userId, title, body, data } = job.data;
        this.logger.log(`📬 Notification générique pour user ${userId}`);

        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (user?.fcmToken) {
            await this.notificationService.sendPushNotification(
                user.fcmToken,
                title,
                body,
                data,
            );
        } else {
            this.logger.warn(`⚠️ User ${userId} introuvable ou sans token FCM`);
        }

        this.logger.log(`✅ Notification générique traitée pour user ${userId}`);
        return { success: true, userId, timestamp: new Date().toISOString() };
    }

    // NOTE : Le handler @Process() sans nom a été supprimé volontairement.
    // Il servait de "fallback" et capturait TOUS les jobs non reconnus en les faisant crasher,
    // provoquant des boucles de retry infinis dans Bull.
}
