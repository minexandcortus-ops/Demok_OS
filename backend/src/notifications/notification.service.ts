import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Repository } from 'typeorm';
import { Queue } from 'bull';
import { VoteRegistry } from '../votes/vote-registry.entity';
import { User } from '../users/user.entity';
import { Citizen } from '../users/citizen.entity';
import { Law, LawStatus } from '../laws/law.entity';
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

        @InjectRepository(Citizen)
        private citizenRepository: Repository<Citizen>,

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
                const content = this.buildLawResultContent(law);
                hash = `law_${law.id}_${content.kind}`;
                title = content.title;
                body = content.body;
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
     * Construit le titre/corps d'une notification de résultat de loi.
     * Le statut de la loi (source de vérité affichée dans la webapp) prime sur
     * deputyVoteResult, qui peut être absent (adoption sans scrutin public, promulgation).
     */
    private buildLawResultContent(law: Law): { kind: string; title: string; body: string } {
        const name = law.titleVulgarized || law.titleOfficial;
        const stats = law.deputyVoteResult;

        if (law.status === LawStatus.VALIDATED) {
            const d = law.datePromulgation ? new Date(law.datePromulgation) : null;
            const dateStr = d ? ` le ${d.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })}` : '';
            return {
                kind: 'promulgated',
                title: '📜 Loi promulguée !',
                body: `La loi "${name}" a été promulguée${dateStr}.`,
            };
        }

        let adopted: boolean;
        if (law.status === LawStatus.REJECTED) adopted = false;
        else if (law.status === LawStatus.VOTED_AN || law.status === LawStatus.AT_SENATE) adopted = true;
        else adopted = stats?.adopted ?? true;

        let body = adopted
            ? `L'Assemblée a adopté la loi "${name}".`
            : `L'Assemblée a rejeté la loi "${name}".`;
        if (stats && (stats.pour > 0 || stats.contre > 0)) {
            const total = stats.pour + stats.contre;
            const pourPercent = Math.round((stats.pour / total) * 100);
            const contrePercent = Math.round((stats.contre / total) * 100);
            body = body.replace(/\.$/, ` (Pour : ${pourPercent}%, Contre : ${contrePercent}%).`);
        }

        return {
            kind: adopted ? 'adopted' : 'rejected',
            title: adopted ? '🏛️ Loi adoptée !' : '🏛️ Loi rejetée !',
            body,
        };
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

        const { title, body } = this.buildLawResultContent(law);

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
     * Envoie une notification aux utilisateurs abonnés pour les lois prévues au vote demain (J-1).
     * Règle stricte :
     * - Rappel uniquement à ceux qui n'ont pas encore voté.
     * - Si 1 seule loi non votée : notification personnalisée citant le titre de la loi.
     * - Si plusieurs lois non votées : notification générique indiquant le nombre de lois restantes à voter.
     * - Si le citoyen a déjà voté sur toutes les lois de demain : aucune notification envoyée.
     * Exécuté chaque matin (à 8h30 par le cron).
     */
    async processUpcomingLawsNotifications(force = false): Promise<void> {
        this.logger.log('📢 Vérification des lois prévues au vote demain (J-1)...');

        // Calcul des bornes de demain dans le fuseau Europe/Paris
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' });
        const todayParisStr = formatter.format(now); // e.g. "2026-11-11"
        
        const todayParis = new Date(`${todayParisStr}T00:00:00.000Z`);
        const tomorrowStart = new Date(todayParis.getTime() + 24 * 60 * 60 * 1000);
        const tomorrowEnd = new Date(todayParis.getTime() + 48 * 60 * 60 * 1000 - 1);
        const tomorrowStr = tomorrowStart.toISOString().split('T')[0];

        const redis = this.notificationQueue.client;
        const redisKey = `upcoming_laws_notified_${tomorrowStr}`;

        if (!force) {
            const alreadySent = await redis.get(redisKey);
            if (alreadySent) {
                this.logger.log(`ℹ️ Notifications pour les lois de demain (${tomorrowStr}) déjà envoyées.`);
                return;
            }
        }

        // Recherche des lois non encore résolues dont la date d'agenda/vote est demain
        const upcomingLaws = await this.lawRepository
            .createQueryBuilder('law')
            .where('law.status IN (:...statuses)', { statuses: [LawStatus.UPCOMING, LawStatus.PENDING] })
            .andWhere(
                'COALESCE(law.agendaDate, law.voteDate) >= :start AND COALESCE(law.agendaDate, law.voteDate) <= :end',
                { start: tomorrowStart, end: tomorrowEnd }
            )
            .getMany();

        if (upcomingLaws.length === 0) {
            this.logger.log(`ℹ️ Aucune loi prévue au vote pour demain (${tomorrowStr}).`);
            return;
        }

        this.logger.log(`📢 ${upcomingLaws.length} loi(s) prévue(s) au vote demain (${tomorrowStr}).`);
        const upcomingLawIds = upcomingLaws.map(l => l.id);

        // Récupérer tous les citoyens abonnés et ayant un token FCM actif
        const citizens = await this.citizenRepository
            .createQueryBuilder('citizen')
            .innerJoinAndSelect('citizen.user', 'user')
            .where('user.notifyUpcomingLaws = :val', { val: true })
            .andWhere('user.fcmToken IS NOT NULL')
            .getMany();

        if (citizens.length === 0) {
            this.logger.log('ℹ️ Aucun utilisateur abonné avec token FCM.');
            return;
        }

        // Récupérer les votes déjà émis pour ces lois afin de ne notifier que les citoyens qui n'ont pas encore voté
        const existingVotes = await this.voteRegistryRepository
            .createQueryBuilder('vote')
            .leftJoinAndSelect('vote.citizen', 'citizen')
            .leftJoinAndSelect('vote.law', 'law')
            .where('law.id IN (:...upcomingLawIds)', { upcomingLawIds })
            .getMany();

        const citizenVotedMap = new Map<string, Set<string>>();
        for (const v of existingVotes) {
            const cId = v.citizen?.id;
            const lId = v.law?.id;
            if (!cId || !lId) continue;
            if (!citizenVotedMap.has(cId)) {
                citizenVotedMap.set(cId, new Set());
            }
            citizenVotedMap.get(cId)!.add(lId);
        }

        // Grouper les tokens par payload (multicast performant)
        const multicastGroups = new Map<string, { title: string, body: string, data: any, tokens: string[] }>();

        for (const citizen of citizens) {
            const token = citizen.user?.fcmToken;
            if (!token) continue;

            const votedSet = citizenVotedMap.get(citizen.id) || new Set();
            const unvotedLaws = upcomingLaws.filter(l => !votedSet.has(l.id));

            // Si le citoyen a déjà voté sur toutes les lois de demain : 0 notification
            if (unvotedLaws.length === 0) {
                continue;
            }

            let hash = '';
            let title = '';
            let body = '';
            let notifData: any = {};

            if (unvotedLaws.length === 1) {
                // Exactement 1 loi restante à voter : notification nominative
                const law = unvotedLaws[0];
                const name = law.titleVulgarized || law.titleOfficial;
                hash = `law_${law.id}`;
                title = '🏛️ Vote demain à l\'Assemblée !';
                body = `La loi "${name}" sera votée demain. Donnez votre avis citoyen !`;
                notifData = { type: 'LAW_UPCOMING', lawId: law.id };
            } else {
                // Plusieurs lois restantes : notification générique
                const count = unvotedLaws.length;
                hash = `group_${count}`;
                title = '🏛️ Votes prévus demain !';
                body = `${count} lois que vous n'avez pas encore votées sont au programme demain. Donnez votre avis citoyen !`;
                notifData = { type: 'LAW_GROUP' };
            }

            if (!multicastGroups.has(hash)) {
                multicastGroups.set(hash, { title, body, data: notifData, tokens: [] });
            }
            multicastGroups.get(hash)!.tokens.push(token);
        }

        let totalSent = 0;
        const chunkSize = 500;
        for (const group of multicastGroups.values()) {
            for (let i = 0; i < group.tokens.length; i += chunkSize) {
                const chunkTokens = group.tokens.slice(i, i + chunkSize);
                await this.notificationQueue.add('multicast-push', {
                    tokens: chunkTokens,
                    title: group.title,
                    body: group.body,
                    data: group.data,
                });
                totalSent += chunkTokens.length;
            }
        }

        await redis.set(redisKey, 'sent', 'EX', 36 * 3600); // Expiration 36h
        this.logger.log(`✅ ${totalSent} rappel(s) de lois à venir (J-1) programmé(s).`);
    }
}
