import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vote } from '../votes/vote.entity';
import { VoteRegistry } from '../votes/vote-registry.entity';
import { VoteUrna } from '../votes/vote-choice.entity';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AnonymityMigrationService implements OnModuleInit {
    private readonly logger = new Logger(AnonymityMigrationService.name);

    constructor(
        @InjectRepository(Vote)
        private readonly legacyVoteRepository: Repository<Vote>,
        @InjectRepository(VoteRegistry)
        private readonly registryRepository: Repository<VoteRegistry>,
        @InjectRepository(VoteUrna)
        private readonly urnaRepository: Repository<VoteUrna>,
        private readonly configService: ConfigService,
    ) {
        this.logger.log('🚀 AnonymityMigrationService instantiated.');
    }

    async onModuleInit() {
        this.logger.log('Starting legacy votes migration process...');
        await this.migrateLegacyVotes();
    }

    async migrateLegacyVotes() {
        try {
            const secret = this.configService.get<string>('VOTE_SECRET');
            if (!secret) {
                this.logger.error('❌ MIGRATION ABORTED: VOTE_SECRET is missing in environment!');
                return;
            }

            const legacyVotes = await this.legacyVoteRepository.find({
                relations: ['citizen', 'law']
            });

            if (legacyVotes.length === 0) {
                this.logger.log('✅ No legacy votes to migrate.');
                return;
            }

            this.logger.log(`⏳ Found ${legacyVotes.length} legacy votes. Starting anonymization process...`);

            let migratedCount = 0;

            for (const v of legacyVotes) {
                if (!v.citizen || !v.law) continue;

                // 1. Generate token
                const token = crypto
                    .createHmac('sha256', secret)
                    .update(`${v.citizen.id}:${v.law.id}`)
                    .digest('hex');

                // 2. Check if already exists in registry to avoid duplicates
                const exists = await this.registryRepository.findOne({
                    where: { citizen: { id: v.citizen.id }, law: { id: v.law.id } }
                });

                if (exists) {
                    // Already migrated or manual double entry? Delete legacy to clean up.
                    await this.legacyVoteRepository.delete(v.id);
                    continue;
                }

                // 3. Create Registry entry
                const registry = new VoteRegistry();
                registry.citizen = v.citizen;
                registry.law = v.law;
                registry.votedAt = v.createdAt;

                // 4. Create Urna entry
                const urna = new VoteUrna();
                urna.voterToken = token;
                urna.law = v.law;
                urna.choice = v.choice;
                urna.createdAt = v.createdAt;

                try {
                    await this.registryRepository.save(registry);
                    await this.urnaRepository.save(urna);
                    // 5. Delete legacy vote only after successful migration
                    await this.legacyVoteRepository.delete(v.id);
                    migratedCount++;
                } catch (e) {
                    this.logger.error(`Failed to migrate vote ${v.id}: ${e.message}`);
                }
            }

            this.logger.log(`🎉 Anonymization migration completed: ${migratedCount} votes migrated.`);
        } catch (error) {
            this.logger.error(`❌ Migration failed: ${error.message}`);
        }
    }
}
