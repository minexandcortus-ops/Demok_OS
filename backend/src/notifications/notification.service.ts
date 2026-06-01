import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Repository } from 'typeorm';
import { Queue } from 'bull';
import { VoteRegistry } from '../votes/vote-registry.entity';
import * as admin from 'firebase-admin';

@Injectable()
export class NotificationService {
    private readonly logger = new Logger(NotificationService.name);
    private isInitialized = false;

    constructor(
        @InjectRepository(VoteRegistry)
        private voteRegistryRepository: Repository<VoteRegistry>,

        @InjectQueue('notifications')
        private notificationQueue: Queue,
    ) { 
        this.initializeFirebase();
    }

    private initializeFirebase() {
        try {
            if (!admin.apps.length) {
                admin.initializeApp({
                    credential: admin.credential.applicationDefault() 
                });
                this.isInitialized = true;
                this.logger.log('Firebase Admin initialized successfully');
            } else {
                this.isInitialized = true;
            }
        } catch (error) {
            this.logger.error('Failed to init Firebase Admin', error);
        }
    }

    private getWebpushLink(data?: Record<string, string>): string {
        if (!data) return '/';
        if (data.type === 'NEW_SURVEY' || data.type === 'SURVEY_CLOSED') {
            return '/surveys';
        } else if (data.type === 'LAW_MODIFIED' && data.lawId) {
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
                webpush: { fcmOptions: { link: this.getWebpushLink(data) } }
            });
            this.logger.log(`Push sent successfully`);
        } catch (error) {
            this.logger.error('Error sending push:', error);
        }
    }

    async sendMulticast(tokens: string[], title: string, body: string, data?: Record<string, string>) {
        if (!this.isInitialized || !tokens || tokens.length === 0) return;
        try {
            const response = await admin.messaging().sendEachForMulticast({
                tokens,
                notification: { title, body },
                data,
                webpush: { fcmOptions: { link: this.getWebpushLink(data) } }
            });
            this.logger.log(`Multicast sent: ${response.successCount} success, ${response.failureCount} failed`);
        } catch (error) {
            this.logger.error('Error sending multicast:', error);
        }
    }

    /**
     * Notifie tous les utilisateurs ayant voté sur une loi modifiée
     * PHASE 3 : ACTIVÉ - Ajout dans queue Bull
     */
    async notifyLawModified(lawId: string): Promise<void> {
        this.logger.log(`📢 Notification loi modifiée : ID ${lawId}`);

        // Récupérer tous les votes actifs sur cette loi
        const votes = await this.voteRegistryRepository
            .createQueryBuilder('vote')
            .leftJoinAndSelect('vote.citizen', 'citizen')
            .leftJoinAndSelect('citizen.user', 'user')
            .leftJoinAndSelect('vote.law', 'law')
            .where('law.id = :lawId', { lawId })
            .getMany();

        this.logger.log(`👥 ${votes.length} utilisateurs à notifier`);

        // PHASE 3 : Ajouter chaque notification dans la queue Bull
        for (const vote of votes) {
            try {
                const userId = vote.citizen?.user?.id;
                if (!userId) continue;

                await this.notificationQueue.add('law-modified', {
                    userId: userId,
                    lawId: lawId,
                    lawTitle: vote.law?.titleOfficial || 'Loi sans titre',
                    message: `La loi "${vote.law?.titleOfficial}" sur laquelle vous avez voté a été modifiée.`,
                    type: 'LAW_MODIFIED',
                });

                this.logger.log(`✅ Notification ajoutée à la queue pour user ${userId}`);
            } catch (error) {
                this.logger.error(`❌ Erreur ajout notification queue: ${error.message}`);
            }
        }

        this.logger.log(`📬 ${votes.length} notifications ajoutées à la queue Redis`);
    }
}
