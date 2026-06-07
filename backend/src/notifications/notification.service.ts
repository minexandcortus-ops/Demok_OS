import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Repository } from 'typeorm';
import { Queue } from 'bull';
import { VoteRegistry } from '../votes/vote-registry.entity';
import { User } from '../users/user.entity';
import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class NotificationService {
    private readonly logger = new Logger(NotificationService.name);
    private isInitialized = false;

    constructor(
        @InjectRepository(VoteRegistry)
        private voteRegistryRepository: Repository<VoteRegistry>,

        @InjectRepository(User)
        private userRepository: Repository<User>,

        @InjectQueue('notifications')
        private notificationQueue: Queue,
    ) {
        this.initializeFirebase();
    }

    private initializeFirebase() {
        try {
            if (admin.apps.length) {
                this.isInitialized = true;
                return;
            }

            // Résolution du chemin vers le fichier de service account
            // On cherche d'abord via la variable d'env, sinon chemin par défaut
            const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
            const defaultPath = path.resolve(__dirname, '../../demok-firebase-service-account.json');
            const serviceAccountPath = envPath
                ? path.resolve(process.cwd(), envPath)
                : defaultPath;

            if (!fs.existsSync(serviceAccountPath)) {
                this.logger.error(`❌ Firebase : fichier service account introuvable à ${serviceAccountPath}`);
                return;
            }

            const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });

            this.isInitialized = true;
            this.logger.log('✅ Firebase Admin initialisé avec succès');
        } catch (error) {
            this.logger.error('❌ Échec initialisation Firebase Admin', error);
        }
    }

    private getWebpushLink(data?: Record<string, string>): string {
        if (!data) return '/';
        if (data.type === 'NEW_SURVEY' || data.type === 'SURVEY_CLOSED') {
            return '/surveys';
        } else if (
            (data.type === 'LAW_MODIFIED' || data.type === 'LAW_VOTED') &&
            data.lawId
        ) {
            return `/laws/${data.lawId}`;
        }
        return '/';
    }

    async sendPushNotification(fcmToken: string, title: string, body: string, data?: Record<string, string>) {
        if (!this.isInitialized || !fcmToken) return;
        try {
            await admin.messaging().send({
                notification: { title, body },
                data,
                token: fcmToken,
                webpush: { fcmOptions: { link: this.getWebpushLink(data) } },
            });
            this.logger.log('📤 Push individuel envoyé avec succès');
        } catch (error) {
            this.logger.error(`❌ Erreur envoi push : ${error.message}`);

            // Nettoyer le token invalide/expiré
            if (
                error.code === 'messaging/invalid-registration-token' ||
                error.code === 'messaging/registration-token-not-registered'
            ) {
                await this.userRepository.update({ fcmToken }, { fcmToken: null });
                this.logger.warn(`🧹 Token FCM invalide supprimé pour token: ${fcmToken.substring(0, 20)}...`);
            }
        }
    }

    async sendMulticast(tokens: string[], title: string, body: string, data?: Record<string, string>) {
        if (!this.isInitialized || !tokens || tokens.length === 0) return;
        try {
            const response = await admin.messaging().sendEachForMulticast({
                tokens,
                notification: { title, body },
                data,
                webpush: { fcmOptions: { link: this.getWebpushLink(data) } },
            });

            this.logger.log(`📤 Multicast : ${response.successCount} succès, ${response.failureCount} échec(s)`);

            // Nettoyer les tokens invalides/expirés
            if (response.failureCount > 0) {
                const invalidTokens: string[] = [];
                response.responses.forEach((resp, idx) => {
                    if (!resp.success) {
                        const code = resp.error?.code;
                        if (
                            code === 'messaging/invalid-registration-token' ||
                            code === 'messaging/registration-token-not-registered'
                        ) {
                            invalidTokens.push(tokens[idx]);
                        } else {
                            this.logger.warn(`⚠️ Échec token [${idx}] : ${code}`);
                        }
                    }
                });

                if (invalidTokens.length > 0) {
                    // Suppression en base des tokens expirés
                    for (const token of invalidTokens) {
                        await this.userRepository.update({ fcmToken: token }, { fcmToken: null });
                    }
                    this.logger.warn(`🧹 ${invalidTokens.length} token(s) FCM invalide(s) supprimé(s)`);
                }
            }
        } catch (error) {
            this.logger.error(`❌ Erreur multicast : ${error.message}`);
        }
    }

    /**
     * Notifie tous les utilisateurs ayant voté sur une loi dont le résultat est maintenant connu.
     * Utilise un seul job multicast au lieu d'un job par utilisateur (évite N+1 sur la queue).
     */
    async notifyLawModified(lawId: string): Promise<void> {
        this.logger.log(`📢 Notification loi votée : ID ${lawId}`);

        // Récupérer les tokens FCM directement depuis la jointure
        const votes = await this.voteRegistryRepository
            .createQueryBuilder('vote')
            .leftJoinAndSelect('vote.citizen', 'citizen')
            .leftJoinAndSelect('citizen.user', 'user')
            .leftJoinAndSelect('vote.law', 'law')
            .where('law.id = :lawId', { lawId })
            .andWhere('user.notifyLawResults = :val', { val: true })
            .andWhere('user.fcmToken IS NOT NULL')
            .getMany();

        const tokens = votes
            .map(v => v.citizen?.user?.fcmToken)
            .filter((t): t is string => !!t);

        const lawTitle = votes[0]?.law?.titleOfficial || 'une loi';

        this.logger.log(`👥 ${tokens.length} token(s) à notifier pour la loi "${lawTitle.substring(0, 50)}"`);

        if (tokens.length === 0) return;

        // Un seul job multicast au lieu de N jobs individuels
        await this.notificationQueue.add('law-modified', {
            tokens,
            lawId,
            lawTitle,
            message: `La loi "${lawTitle}" sur laquelle vous avez voté vient d'être votée à l'Assemblée Nationale.`,
            type: 'LAW_MODIFIED',
        });

        this.logger.log(`✅ Job multicast "law-modified" ajouté à la queue (${tokens.length} destinataires)`);
    }

    /**
     * Notifie tous les utilisateurs (avec l'option activée) du résultat du vote d'une loi.
     */
    async notifyLawVoted(lawId: string, lawTitle: string, resultStats: any, adopted: boolean): Promise<void> {
        this.logger.log(`📢 Notification résultat loi : ID ${lawId}`);
        try {
            await this.notificationQueue.add('law-voted', {
                lawId,
                lawTitle,
                resultStats,
                adopted,
            });
            this.logger.log(`✅ Job "law-voted" ajouté à la queue pour la loi ${lawId}`);
        } catch (error) {
            this.logger.error(`❌ Erreur ajout notification "law-voted" : ${error.message}`);
        }
    }

    /**
     * Envoie une notification de nouveau sondage à tous les utilisateurs abonnés.
     */
    async notifyNewSurvey(pollId: string, question: string): Promise<void> {
        this.logger.log(`📢 Notification nouveau sondage : ${question}`);
        try {
            await this.notificationQueue.add('new-survey', { pollId, question });
        } catch (error) {
            this.logger.error(`❌ Erreur ajout notification "new-survey" : ${error.message}`);
        }
    }

    /**
     * Envoie une notification de sondage clôturé aux participants.
     */
    async notifySurveyClosed(pollId: string, question: string, voterIds: string[]): Promise<void> {
        this.logger.log(`📢 Notification sondage clôturé : ${question}`);
        if (!voterIds || voterIds.length === 0) return;
        try {
            await this.notificationQueue.add('survey-closed', { pollId, question, voterIds });
        } catch (error) {
            this.logger.error(`❌ Erreur ajout notification "survey-closed" : ${error.message}`);
        }
    }
}
