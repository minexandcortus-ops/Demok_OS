import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Repository } from 'typeorm';
import { Queue } from 'bull';
import { VoteRegistry } from '../votes/vote-registry.entity';
import { User } from '../users/user.entity';
import { Law } from '../laws/law.entity';
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

        @InjectRepository(Law)
        private lawRepository: Repository<Law>,

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
     * Ajoute une loi à la file d'attente nocturne (Redis Set) pour être traitée à 8h00.
     */
    async queueMorningDigest(lawId: string): Promise<void> {
        this.logger.log(`📥 Loi ${lawId} ajoutée à la file d'attente matinale.`);
        const redis = this.notificationQueue.client;
        await redis.sadd('morning_digest_laws', lawId);
    }

    /**
     * Fonction exécutée à 8h00 par le Cron.
     * Regroupe les notifications de la nuit et les envoie par lots.
     */
    async processMorningDigest(): Promise<void> {
        this.logger.log('🌅 Début du traitement du Morning Digest (Batching des notifications)');
        const redis = this.notificationQueue.client;
        
        const lawIds = await redis.smembers('morning_digest_laws');
        if (!lawIds || lawIds.length === 0) {
            this.logger.log('✅ Aucune loi à notifier ce matin.');
            return;
        }

        // On vide la liste immédiatement pour éviter de relancer en cas de double exécution
        await redis.del('morning_digest_laws');

        const laws = await this.lawRepository.findByIds(lawIds);
        if (laws.length === 0) return;

        // Récupérer les votes de tous les utilisateurs pour ces lois
        const votes = await this.voteRegistryRepository
            .createQueryBuilder('vote')
            .leftJoinAndSelect('vote.citizen', 'citizen')
            .leftJoinAndSelect('citizen.user', 'user')
            .leftJoinAndSelect('vote.law', 'law')
            .where('law.id IN (:...lawIds)', { lawIds })
            .andWhere('user.notifyLawResults = :val', { val: true })
            .andWhere('user.fcmToken IS NOT NULL')
            .getMany();

        // Grouper les lois votées par token utilisateur
        const userMap = new Map<string, Law[]>();
        for (const vote of votes) {
            const token = vote.citizen?.user?.fcmToken;
            if (!token) continue;
            if (!userMap.has(token)) userMap.set(token, []);
            userMap.get(token)!.push(vote.law);
        }

        // Grouper les tokens par payload pour utiliser le Multicast (très performant)
        const multicastGroups = new Map<string, { title: string, body: string, data: any, tokens: string[] }>();

        for (const [token, votedLaws] of userMap.entries()) {
            const count = votedLaws.length;
            let hash = '';
            let title = '';
            let body = '';
            let notifData: any = {};

            if (count === 1) {
                const law = votedLaws[0];
                hash = `law_${law.id}`;
                const stats = law.deputyVoteResult;
                const adopted = stats?.adopted ?? false;
                
                title = adopted ? '🏛️ Loi adoptée !' : '🏛️ Loi rejetée !';
                body = `L'Assemblée a voté la loi "${law.titleVulgarized || law.titleOfficial}".`;
                
                if (stats && (stats.pour > 0 || stats.contre > 0)) {
                    const total = stats.pour + stats.contre;
                    const pourPercent = Math.round((stats.pour / total) * 100);
                    const contrePercent = Math.round((stats.contre / total) * 100);
                    body = `L'Assemblée a voté la loi "${law.titleVulgarized || law.titleOfficial}" (Pour: ${pourPercent}%, Contre: ${contrePercent}%).`;
                }
                notifData = { type: 'LAW_VOTED', lawId: law.id };
            } else {
                hash = `group_${count}`;
                title = '🏛️ Nouveaux résultats !';
                body = `Les résultats officiels de ${count} lois sur lesquelles vous avez voté sont disponibles.`;
                notifData = { type: 'LAW_GROUP' }; // Ouvre simplement l'onglet "Lois"
            }

            if (!multicastGroups.has(hash)) {
                multicastGroups.set(hash, { title, body, data: notifData, tokens: [] });
            }
            multicastGroups.get(hash)!.tokens.push(token);
        }

        // Pousser les jobs de notification dans la queue (par paquets de 500)
        let totalSent = 0;
        for (const group of multicastGroups.values()) {
            const chunkSize = 500;
            for (let i = 0; i < group.tokens.length; i += chunkSize) {
                const chunkTokens = group.tokens.slice(i, i + chunkSize);
                await this.notificationQueue.add('multicast-push', {
                    tokens: chunkTokens,
                    title: group.title,
                    body: group.body,
                    data: group.data
                });
                totalSent += chunkTokens.length;
            }
        }

        this.logger.log(`✅ Morning Digest terminé : ${totalSent} notifications programmées.`);
    }

    /**
     * Envoi immédiat ciblé (utilisé par le bouton Admin)
     */
    async sendTargetedLawNotification(lawId: string): Promise<void> {
        this.logger.log(`📢 Notification manuelle ciblée : ID ${lawId}`);

        const law = await this.lawRepository.findOne({ where: { id: lawId } });
        if (!law) return;

        const votes = await this.voteRegistryRepository
            .createQueryBuilder('vote')
            .leftJoinAndSelect('vote.citizen', 'citizen')
            .leftJoinAndSelect('citizen.user', 'user')
            .where('vote.lawId = :lawId', { lawId })
            .andWhere('user.notifyLawResults = :val', { val: true })
            .andWhere('user.fcmToken IS NOT NULL')
            .getMany();

        const tokens = votes
            .map(v => v.citizen?.user?.fcmToken)
            .filter((t): t is string => !!t);

        if (tokens.length === 0) {
            this.logger.log(`✅ Aucun utilisateur à notifier pour la loi ${lawId}`);
            return;
        }

        const stats = law.deputyVoteResult;
        const adopted = stats?.adopted ?? false;
        
        const title = adopted ? '🏛️ Loi adoptée !' : '🏛️ Loi rejetée !';
        let body = `L'Assemblée a voté la loi "${law.titleVulgarized || law.titleOfficial}".`;
        
        if (stats && (stats.pour > 0 || stats.contre > 0)) {
            const total = stats.pour + stats.contre;
            const pourPercent = Math.round((stats.pour / total) * 100);
            const contrePercent = Math.round((stats.contre / total) * 100);
            body = `L'Assemblée a voté la loi "${law.titleVulgarized || law.titleOfficial}" (Pour: ${pourPercent}%, Contre: ${contrePercent}%).`;
        }

        // Chunk by 500 and queue
        const chunkSize = 500;
        for (let i = 0; i < tokens.length; i += chunkSize) {
            const chunkTokens = tokens.slice(i, i + chunkSize);
            await this.notificationQueue.add('multicast-push', {
                tokens: chunkTokens,
                title,
                body,
                data: { type: 'LAW_VOTED', lawId: law.id }
            });
        }

        this.logger.log(`✅ Job multicast immédiat ajouté à la queue (${tokens.length} destinataires ciblés)`);
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
