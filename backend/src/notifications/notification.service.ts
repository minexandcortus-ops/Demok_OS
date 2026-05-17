import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Repository } from 'typeorm';
import { Queue } from 'bull';
import { VoteRegistry } from '../votes/vote-registry.entity';

@Injectable()
export class NotificationService {
    private readonly logger = new Logger(NotificationService.name);

    constructor(
        @InjectRepository(VoteRegistry)
        private voteRegistryRepository: Repository<VoteRegistry>,

        @InjectQueue('notifications')
        private notificationQueue: Queue,
    ) { }

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
            .leftJoinAndSelect('vote.law', 'law')
            .where('law.id = :lawId', { lawId })
            .getMany();

        this.logger.log(`👥 ${votes.length} utilisateurs à notifier`);

        // PHASE 3 : Ajouter chaque notification dans la queue Bull
        for (const vote of votes) {
            try {
                await this.notificationQueue.add('law-modified', {
                    userId: vote.citizen?.id,
                    lawId: lawId,
                    lawTitle: vote.law?.titleOfficial || 'Loi sans titre',
                    message: `La loi "${vote.law?.titleOfficial}" sur laquelle vous avez voté a été modifiée.`,
                    type: 'LAW_MODIFIED',
                });

                this.logger.log(`✅ Notification ajoutée à la queue pour citizen ${vote.citizen?.id}`);
            } catch (error) {
                this.logger.error(`❌ Erreur ajout notification queue: ${error.message}`);
            }
        }

        this.logger.log(`📬 ${votes.length} notifications ajoutées à la queue Redis`);
    }
}
