import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Brackets } from 'typeorm';
import { VoteRegistry } from './vote-registry.entity';
import { VoteUrna } from './vote-choice.entity';
import { VoteChoice } from './vote.types';
import { Law, LawStatus } from '../laws/law.entity';
import { Citizen } from '../users/citizen.entity';
import { OfficialVote } from './official-vote.entity';
import { Deputy } from './deputy.entity';
import { VoteDto, VoteResponseDto } from './dto/vote.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { VoteCastEvent } from './events/vote-cast.event';
import { LawFavorite } from '../laws/law-favorite.entity';
import * as crypto from 'crypto';

@Injectable()
export class VotesService {
    /**
     * @param lawRepository Repository for laws/proposals
     * @param citizenRepository Repository for citizen profiles
     * @param officialVoteRepository Repository for votes cast by deputies
     * @param deputyRepository Repository for deputy details
     * @param gamificationService Service handling XP and levels
     */
    constructor(
        @InjectRepository(VoteRegistry)
        private readonly voteRegistryRepository: Repository<VoteRegistry>,
        @InjectRepository(VoteUrna)
        private readonly voteUrnaRepository: Repository<VoteUrna>,
        @InjectRepository(Law)
        private readonly lawRepository: Repository<Law>,
        @InjectRepository(Citizen)
        private readonly citizenRepository: Repository<Citizen>,
        @InjectRepository(OfficialVote)
        private readonly officialVoteRepository: Repository<OfficialVote>,
        @InjectRepository(Deputy)
        private readonly deputyRepository: Repository<Deputy>,
        @InjectRepository(LawFavorite)
        private readonly lawFavoriteRepository: Repository<LawFavorite>,
        private readonly eventEmitter: EventEmitter2,
    ) { }

    /**
     * Gère l'anonymisation du vote par hachage cryptographique.
     * @returns VoterToken unique pour (user + loi)
     */
    private generateVoterToken(citizenId: string, lawId: string): string {
        const secret = process.env.VOTE_SECRET;
        if (!secret) {
            throw new Error('VOTE_SECRET environment variable is not defined');
        }
        return crypto
            .createHmac('sha256', secret)
            .update(`${citizenId}:${lawId}`)
            .digest('hex');
    }

    /**
     * Casts a new vote for a law.
     * Validates that the citizen exists, the law exists, and no prior vote has been cast.
     * Triggers XP updates via GamificationService.
     * 
     * @param userId The unique ID of the user (from Auth)
     * @param dto Data containing lawId and choice (FOR, AGAINST, ABSTAIN)
     * @returns Statistics and deputy comparison results
     * @throws NotFoundException if user or law not found
     * @throws ConflictException if user already voted
     */
    async castVote(userId: string, dto: VoteDto): Promise<VoteResponseDto> {
        // Find citizen by user id
        const citizen = await this.citizenRepository.findOne({
            where: { user: { id: userId } },
            relations: ['user'],
        });

        if (!citizen) {
            throw new NotFoundException('Citizen profile not found');
        }

        // Find law
        const law = await this.lawRepository.findOne({
            where: { id: dto.lawId },
        });

        if (!law) {
            throw new NotFoundException('Law not found');
        }

        // --- New Anonymized Logic (Double Registry) ---
        const voterToken = this.generateVoterToken(citizen.id, law.id);
        
        // 1. Check if voted in Registry
        const registryEntry = await this.voteRegistryRepository.findOne({
            where: { citizen: { id: citizen.id }, law: { id: law.id } }
        });

        let isNewVote = false;
        let choiceEntry: VoteUrna;
        let xpGains: Array<{ amount: number; reason: string }> = [];

        if (registryEntry) {
            // Citizen has already voted
            if (law.status !== LawStatus.PENDING && law.status !== LawStatus.UPCOMING) {
                throw new ConflictException('Impossible de modifier le vote : la période est close');
            }
            
            // Find anonymized choice
            choiceEntry = await this.voteUrnaRepository.findOne({ where: { voterToken } });
            if (!choiceEntry) {
                // Should not happen if registry exists, but handle for safety
                choiceEntry = new VoteUrna();
                choiceEntry.voterToken = voterToken;
                choiceEntry.law = law;
            }
            choiceEntry.choice = VoteChoice[dto.choice];
            await this.voteUrnaRepository.save(choiceEntry);
        } else {
            // First time voting
            isNewVote = true;
            
            // a. Save to Registry (to prevent double vote)
            const newRegistry = new VoteRegistry();
            newRegistry.citizen = citizen;
            newRegistry.law = law;
            await this.voteRegistryRepository.save(newRegistry);

            // b. Save to Urne (anonymized choice)
            const newChoice = new VoteUrna();
            newChoice.voterToken = voterToken;
            newChoice.law = law;
            newChoice.choice = VoteChoice[dto.choice];
            await this.voteUrnaRepository.save(newChoice);

            // === Gamification: handle XP ===
            const eventResults = await this.eventEmitter.emitAsync(
                'vote.cast',
                new VoteCastEvent(citizen.id, law.id),
            );
            xpGains = eventResults.flat() as Array<{ amount: number; reason: string }>;
        }

        // Statistics are calculated from the anonymized urna
        const statistics = await this.getVoteStatistics(law.id);

        let deputyVote = null;
        if (citizen.constituencyCode) {
            const deputy = await this.deputyRepository.findOne({
                where: { constituencyCode: citizen.constituencyCode },
            });

            if (deputy) {
                const officialVote = await this.officialVoteRepository.findOne({
                    where: {
                        deputy: { id: deputy.id },
                        law: { id: law.id },
                    },
                    relations: ['deputy'],
                });

                if (officialVote) {
                    deputyVote = {
                        choice: officialVote.choice,
                        deputyName: deputy.fullName,
                        agreement: officialVote.choice === VoteChoice[dto.choice],
                    };
                }
            }
        }

        return {
            success: true,
            message: isNewVote ? 'Vote enregistré anonymement' : 'Vote mis à jour anonymement',
            statistics,
            deputyVote,
            xpGains,
        };
    }

    /**
     * Aggregates voting statistics for a specific law.
     * Calculates percentages for each choice.
     * 
     * @param lawId The UUID of the law
     * @returns Object with total count and percentages
     */
    async getVoteStatistics(lawId: string) {
        const stats = await this.voteUrnaRepository
            .createQueryBuilder('vote')
            .select('vote.choice', 'choice')
            .addSelect('COUNT(*)', 'count')
            .where('vote.lawId = :lawId', { lawId })
            .groupBy('vote.choice')
            .getRawMany();

        const counts: Record<string, number> = {};
        let totalVotes = 0;
        for (const row of stats) {
            counts[row.choice] = parseInt(row.count, 10);
            totalVotes += counts[row.choice];
        }

        return {
            totalVotes,
            forPercentage: totalVotes > 0 ? ((counts['FOR'] || 0) / totalVotes) * 100 : 0,
            againstPercentage: totalVotes > 0 ? ((counts['AGAINST'] || 0) / totalVotes) * 100 : 0,
            abstainPercentage: totalVotes > 0 ? ((counts['ABSTAIN'] || 0) / totalVotes) * 100 : 0,
        };
    }

    /**
     * Fetches vote statistics for multiple laws in a single query.
     * Avoids the N+1 problem when loading the law feed.
     */
    private async getBulkVoteStatistics(lawIds: string[]): Promise<Map<string, { totalVotes: number; forPercentage: number; againstPercentage: number; abstainPercentage: number }>> {
        if (lawIds.length === 0) return new Map();

        const stats = await this.voteUrnaRepository
            .createQueryBuilder('vote')
            .select('vote.lawId', 'lawId')
            .addSelect('vote.choice', 'choice')
            .addSelect('COUNT(*)', 'count')
            .where('vote.lawId IN (:...lawIds)', { lawIds })
            .groupBy('vote.lawId')
            .addGroupBy('vote.choice')
            .getRawMany();

        // Aggregate per law
        const lawStats = new Map<string, Record<string, number>>();
        for (const row of stats) {
            if (!lawStats.has(row.lawId)) lawStats.set(row.lawId, {});
            lawStats.get(row.lawId)![row.choice] = parseInt(row.count, 10);
        }

        const result = new Map<string, { totalVotes: number; forPercentage: number; againstPercentage: number; abstainPercentage: number }>();
        for (const lawId of lawIds) {
            const counts = lawStats.get(lawId) || {};
            const total = (counts['FOR'] || 0) + (counts['AGAINST'] || 0) + (counts['ABSTAIN'] || 0);
            result.set(lawId, {
                totalVotes: total,
                forPercentage: total > 0 ? ((counts['FOR'] || 0) / total) * 100 : 0,
                againstPercentage: total > 0 ? ((counts['AGAINST'] || 0) / total) * 100 : 0,
                abstainPercentage: total > 0 ? ((counts['ABSTAIN'] || 0) / total) * 100 : 0,
            });
        }
        return result;
    }

    /**
     * Retrieves a feed of laws with optional filtering and personalized user vote data.
     * Uses SQL-level sorting and pagination for performance.
     * 
     * @param categoryIds Filter by one or more category IDs
     * @param searchQuery Generic search string (title, summary)
     * @param region Filter by region (FRANCE, UE)
     * @param status Filter by status (PENDING, VOTED)
     * @param userId If provided, includes the specific vote cast by this user if any
     * @returns Array of laws with statistics and user vote info
     */
    async getLawsFeed(
        categoryIds: number[] = [],
        searchQuery?: string,
        region?: string,
        status?: string,
        userId?: string,
        sortBy: 'ASC' | 'DESC' = 'DESC',
        page: number = 1,
        limit: number = 10,
        votedOnly?: string,
    ) {
        const queryBuilder = this.lawRepository.createQueryBuilder('law')
            .leftJoinAndSelect('law.categories', 'category');

        if (categoryIds.length > 0) {
            queryBuilder.andWhere('category.id IN (:...categoryIds)', { categoryIds });
        }

        if (searchQuery) {
            queryBuilder.andWhere(
                new Brackets((qb) => {
                    qb.where('law.titleOfficial ILIKE :search', { search: `%${searchQuery}%` })
                        .orWhere('law.titleVulgarized ILIKE :search', { search: `%${searchQuery}%` })
                        .orWhere("law.summary ->> 'context' ILIKE :search", { search: `%${searchQuery}%` });
                })
            );
        }

        if (region) {
            queryBuilder.andWhere('law.region = :region', { region });
        }

        if (status) {
            queryBuilder.andWhere('law.status = :status', { status });
            // Si on demande les lois "En cours" (PENDING), on ne veut que celles à l'ordre du jour
            if (status === LawStatus.PENDING) {
                queryBuilder.andWhere('law.isOnAgenda = true');
            }
        } else if (votedOnly === 'true') {
            // Uniquement les lois passées (Adoptées, Rejetées, En cours de discussion). On exclut celles À venir.
            queryBuilder.andWhere('law.status != :excludeStatus', { excludeStatus: LawStatus.UPCOMING });
        } else {
            // Par défaut (flux principal) :
            // - On cache les lois PENDING qui ne sont plus à l'ordre du jour (isOnAgenda = false)
            // - On cache aussi les lois UPCOMING qui n'ont ni agendaDate ni voteDate (non planifiées)
            queryBuilder.andWhere(
                new Brackets((qb) => {
                    qb.where('law.status != :pendingStatus', { pendingStatus: LawStatus.PENDING })
                        .orWhere('law.isOnAgenda = true');
                })
            );
            queryBuilder.andWhere(
                new Brackets((qb) => {
                    qb.where('law.status != :upcomingStatus', { upcomingStatus: LawStatus.UPCOMING })
                        .orWhere('law."agendaDate" IS NOT NULL')
                        .orWhere('law."voteDate" IS NOT NULL');
                })
            );
        }


        // SQL-level sorting :
        // Priorité 1 : Lois dont le vote est AUJOURD'HUI (date = aujourd'hui) → tout en haut
        // Priorité 2 : Lois UPCOMING (dates futures) → triées par date ASC
        // Priorité 3 : Toutes les autres (discussion passée, votées…) → triées par date DESC
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

        queryBuilder
            .addSelect(
                `CASE
                    WHEN COALESCE(law."agendaDate", law."voteDate") >= :todayStart
                     AND COALESCE(law."agendaDate", law."voteDate") <= :todayEnd
                    THEN 0
                    WHEN law.status = 'UPCOMING' THEN 1
                    ELSE 2
                END`,
                'status_order'
            )
            .addSelect(`CASE WHEN law.status = 'UPCOMING' THEN COALESCE(law."agendaDate", law."voteDate", law."dateDepot") END`, 'pending_date_order')
            .addSelect(`CASE WHEN law.status != 'UPCOMING' THEN COALESCE(law."agendaDate", law."voteDate", law."dateDepot") END`, 'completed_date_order')
            .setParameter('todayStart', todayStart.toISOString())
            .setParameter('todayEnd', todayEnd.toISOString())
            .orderBy('status_order', 'ASC')
            .addOrderBy('pending_date_order', 'ASC', 'NULLS LAST')
            .addOrderBy('completed_date_order', 'DESC', 'NULLS LAST');

        // SQL-level pagination
        const p = Number(page);
        const l = Number(limit);
        queryBuilder.skip((p - 1) * l).take(l);

        const laws = await queryBuilder.getMany();

        if (laws.length === 0) return [];

        const lawIds = laws.map(l => l.id);

        // Bulk fetch vote statistics (single query instead of N queries)
        const statsMap = await this.getBulkVoteStatistics(lawIds);

        // If userId provided, fetch user's votes and favorites for these laws
        let userVotesMap = new Map<string, VoteChoice>();
        let userFavoritesSet = new Set<string>();

        if (userId) {
            const citizen = await this.citizenRepository.findOne({ where: { user: { id: userId } } });

            if (citizen) {
                // Find voter tokens for all fetched laws
                const tokens = lawIds.map(lid => this.generateVoterToken(citizen.id, lid));
                const votes = await this.voteUrnaRepository.find({
                    where: {
                        voterToken: In(tokens),
                        law: { id: In(lawIds) }
                    },
                    relations: ['law']
                });
                votes.forEach(v => {
                   userVotesMap.set(v.law.id, v.choice);
                });
            }

            const favorites = await this.lawFavoriteRepository.find({
                where: {
                    user: { id: userId },
                    law: { id: In(lawIds) }
                },
                relations: ['law']
            });
            favorites.forEach(f => userFavoritesSet.add(f.law.id));
        }

        return laws.map((law) => ({
            ...law,
            statistics: statsMap.get(law.id) || { totalVotes: 0, forPercentage: 0, againstPercentage: 0, abstainPercentage: 0 },
            userVote: userVotesMap.get(law.id) || null,
            isFavorited: userFavoritesSet.has(law.id),
        }));
    }

    /**
     * Retrieves a single law by ID with full statistics and user personalization.
     */
    async getLawById(lawId: string, userId?: string) {
        const law = await this.lawRepository.createQueryBuilder('law')
            .leftJoinAndSelect('law.categories', 'category')
            .where('law.id = :lawId', { lawId })
            .getOne();

        if (!law) throw new NotFoundException('Law not found');

        const statsMap = await this.getBulkVoteStatistics([law.id]);
        let userVote: VoteChoice | null = null;
        let isFavorited = false;

        if (userId) {
            const citizen = await this.citizenRepository.findOne({ where: { user: { id: userId } } });
            if (citizen) {
                const token = this.generateVoterToken(citizen.id, law.id);
                const vote = await this.voteUrnaRepository.findOne({
                    where: { voterToken: token, law: { id: law.id } }
                });
                if (vote) userVote = vote.choice;
            }

            const favorite = await this.lawFavoriteRepository.findOne({
                where: { user: { id: userId }, law: { id: law.id } }
            });
            if (favorite) isFavorited = true;
        }

        return {
            ...law,
            statistics: statsMap.get(law.id) || { totalVotes: 0, forPercentage: 0, againstPercentage: 0, abstainPercentage: 0 },
            userVote,
            isFavorited,
        };
    }

    /**
     * Checks if a user has already voted on a specific law.
     * Used for detail screen pre-rendering and deputy comparison.
     * 
     * @param userId Unique user ID
     * @param lawId Law UUID
     * @returns hasVoted boolean plus statistics and deputy vote if applicable
     */
    async checkVote(userId: string, lawId: string) {
        // Find citizen profile first
        const citizen = await this.citizenRepository.findOne({
            where: { user: { id: userId } },
        });

        if (!citizen) {
            return { hasVoted: false };
        }

        // Find anonymized choice via token
        const voterToken = this.generateVoterToken(citizen.id, lawId);
        const choiceEntry = await this.voteUrnaRepository.findOne({
            where: { voterToken },
        });

        if (!choiceEntry) {
            return { hasVoted: false };
        }

        // Return statistics if voted
        const statistics = await this.getVoteStatistics(lawId);

        // Check deputy match
        let deputyVote = null;
        if (citizen.constituencyCode) {
            const officialVote = await this.officialVoteRepository.findOne({
                where: {
                    law: { id: lawId },
                    deputy: { constituencyCode: citizen.constituencyCode }
                },
                relations: ['deputy']
            });

            if (officialVote) {
                deputyVote = {
                    deputyName: officialVote.deputy.fullName,
                    choice: officialVote.choice,
                    agreement: officialVote.choice === choiceEntry.choice as any
                };
            }
        }

        return {
            hasVoted: true,
            statistics,
            deputyVote,
        };
    }

    /**
     * Toggles the favorite status of a law for a specific user.
     */
    async toggleFavorite(userId: string, lawId: string): Promise<{ isFavorited: boolean }> {
        const law = await this.lawRepository.findOne({ where: { id: lawId } });
        if (!law) throw new NotFoundException('Law not found');

        const existingFavorite = await this.lawFavoriteRepository.findOne({
            where: {
                user: { id: userId },
                law: { id: lawId },
            },
        });

        if (existingFavorite) {
            // Unfavorite
            await this.lawFavoriteRepository.remove(existingFavorite);
            return { isFavorited: false };
        } else {
            // Favorite
            const newFavorite = this.lawFavoriteRepository.create({
                user: { id: userId },
                law: { id: lawId },
            });
            await this.lawFavoriteRepository.save(newFavorite);
            return { isFavorited: true };
        }
    }

    /**
     * Gets all law IDs that the user has favorited.
     */
    async getFavoriteLawIds(userId: string): Promise<string[]> {
        const favorites = await this.lawFavoriteRepository.find({
            where: { user: { id: userId } },
            relations: ['law'],
        });
        return favorites.map(f => f.law.id);
    }
}

