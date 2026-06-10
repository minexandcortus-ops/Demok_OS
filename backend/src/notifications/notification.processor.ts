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
     * Traite les notifications push de masse (utilisé par le Morning Digest et l'Admin).
     * Reçoit le payload exact préparé par le NotificationService.
     */
    @Process('multicast-push')
    async handleMulticastPush(job: Job) {
        const { tokens, title, body, data } = job.data;
        this.logger.log(`📬 Traitement d'un lot multicast (${tokens?.length || 0} destinataires)`);

        if (tokens && tokens.length > 0) {
            await this.notificationService.sendMulticast(
                tokens,
                title,
                body,
                data,
            );
        }

        this.logger.log(`✅ Lot multicast traité avec succès.`);
        return { success: true, count: tokens?.length || 0, timestamp: new Date().toISOString() };
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
