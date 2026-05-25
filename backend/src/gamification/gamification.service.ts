import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { Citizen } from '../users/citizen.entity';
import { CitizenLevel } from './entities/citizen-level.entity';
import { VoteRegistry } from '../votes/vote-registry.entity';
import { Law } from '../laws/law.entity';
import { GameConstants } from './game-constants';
import { VoteCastEvent } from '../votes/events/vote-cast.event';

@Injectable()
export class GamificationService {
    private readonly logger = new Logger(GamificationService.name);

    constructor(
        @InjectRepository(Citizen)
        private readonly citizenRepository: Repository<Citizen>,
        @InjectRepository(CitizenLevel)
        private readonly levelRepository: Repository<CitizenLevel>,
        @InjectRepository(VoteRegistry)
        private readonly voteRegistryRepository: Repository<VoteRegistry>,
        @InjectRepository(Law)
        private readonly lawRepository: Repository<Law>,
    ) { }

    /**
     * Ajoute de l'XP à un citoyen et gère le passage de niveau.
     * @param citizenId UUID du citoyen
     * @param xpAmount Quantité d'XP à ajouter
     * @param reason Raison de l'ajout (pour les logs)
     */
    async addXP(citizenId: string, xpAmount: number, reason: string): Promise<void> {
        const citizen = await this.citizenRepository.findOne({ where: { id: citizenId } });
        if (!citizen) {
            this.logger.warn(`Citizen ${citizenId} not found for XP addition`);
            return;
        }

        const oldLevel = citizen.currentLevel;
        citizen.xp += xpAmount;

        // Recalculer le niveau en fonction du nouvel XP total
        const newLevel = await this.calculateLevel(citizen.xp);
        citizen.currentLevel = newLevel;

        await this.citizenRepository.save(citizen);

        if (newLevel > oldLevel) {
            this.logger.log(`🎉 Passé au niveau supérieur ! ${oldLevel} → ${newLevel} (Citoyen: ${citizen.pseudo})`);
        } else {
            this.logger.log(`✅ ${xpAmount} XP gagnés par ${citizen.pseudo} (Raison: ${reason})`);
        }
    }

    /**
     * Gère l'attribution d'XP et les milestones après un vote.
     * Calcule les bonus (réactivité, milestones de volume, streaks).
     * @param payload Informations sur le vote
     * @returns Array of XP gains with amount and reason
     */
    @OnEvent('vote.cast')
    async handleVote(payload: VoteCastEvent): Promise<Array<{ amount: number; reason: string }>> {
        const { citizenId, lawId } = payload;
        const citizen = await this.citizenRepository.findOne({ where: { id: citizenId } });
        if (!citizen) return [];

        const xpGains: Array<{ amount: number; reason: string }> = [];
        let totalXP = 0;

        // XP de base pour un vote
        xpGains.push({ amount: GameConstants.XP.VOTE, reason: 'A voté' });
        totalXP += GameConstants.XP.VOTE;

        // Incrémenter le compteur de participation
        citizen.totalVotes += 1;

        // === Bonus réactivité (vote dans les 24h après publication) ===
        const law = await this.lawRepository.findOne({ where: { id: lawId } });
        if (law && law.voteDate) {
            const voteDateTime = new Date(law.voteDate).getTime();
            const hoursSincePublication = (Date.now() - voteDateTime) / (1000 * 60 * 60);
            if (hoursSincePublication < 24) {
                xpGains.push({ amount: GameConstants.XP.VOTE_FAST, reason: 'Vote rapide (24h)' });
                totalXP += GameConstants.XP.VOTE_FAST;
                this.logger.log(`⚡ Bonus réactivité : +${GameConstants.XP.VOTE_FAST} XP`);
            }
        }

        // === Milestones de volume de votes ===
        if (citizen.totalVotes === 1 && !citizen.achievedMilestones['first_vote']) {
            xpGains.push({ amount: GameConstants.XP.MILESTONE_1_VOTE, reason: 'Premier vote !' });
            totalXP += GameConstants.XP.MILESTONE_1_VOTE;
            citizen.achievedMilestones['first_vote'] = true;
        }

        if (citizen.totalVotes === 10 && !citizen.achievedMilestones['10_votes']) {
            xpGains.push({ amount: GameConstants.XP.MILESTONE_10_VOTES, reason: '10e loi votée !' });
            totalXP += GameConstants.XP.MILESTONE_10_VOTES;
            citizen.achievedMilestones['10_votes'] = true;
        }

        if (citizen.totalVotes === 50 && !citizen.achievedMilestones['50_votes']) {
            xpGains.push({ amount: GameConstants.XP.MILESTONE_50_VOTES, reason: '50e loi votée !' });
            totalXP += GameConstants.XP.MILESTONE_50_VOTES;
            citizen.achievedMilestones['50_votes'] = true;
        }

        if (citizen.totalVotes === 100 && !citizen.achievedMilestones['100_votes']) {
            xpGains.push({ amount: GameConstants.XP.MILESTONE_100_VOTES, reason: '100e loi votée !' });
            totalXP += GameConstants.XP.MILESTONE_100_VOTES;
            citizen.achievedMilestones['100_votes'] = true;
        }

        // === Streak hebdomadaire (participation régulière) ===
        const now = new Date();
        const lastVoteDate = citizen.lastWeeklyVoteDate;

        if (lastVoteDate) {
            const daysSinceLastVote = (now.getTime() - lastVoteDate.getTime()) / (1000 * 60 * 60 * 24);

            if (daysSinceLastVote < 7) {
                // Déjà voté cette semaine, on ne touche pas au streak
            } else if (daysSinceLastVote < 14) {
                // Vote dans la semaine suivante : le streak continue
                citizen.weeklyVoteStreak += 1;
                citizen.lastWeeklyVoteDate = now;

                if (citizen.weeklyVoteStreak === GameConstants.STREAKS.WEEKLY_CYCLE) {
                    xpGains.push({ amount: GameConstants.XP.WEEKLY_STREAK_BONUS, reason: '4 semaines consécutives !' });
                    totalXP += GameConstants.XP.WEEKLY_STREAK_BONUS;
                    this.logger.log(`🔥 Streak 4 semaines ! +${GameConstants.XP.WEEKLY_STREAK_BONUS} XP`);
                    citizen.weeklyVoteStreak = 0; // Reset du cycle
                }
            } else {
                // Interruption trop longue : reset du streak
                citizen.weeklyVoteStreak = 1;
                citizen.lastWeeklyVoteDate = now;
            }
        } else {
            // Premier vote hebdomadaire enregistré
            citizen.weeklyVoteStreak = 1;
            citizen.lastWeeklyVoteDate = now;
        }

        await this.citizenRepository.save(citizen);
        await this.addXP(citizenId, totalXP, `Vote sur loi ${lawId}`);

        return xpGains;
    }

    /**
     * Enregistre une connexion quotidienne et attribue des bonus de streak.
     * @param citizenId UUID du citoyen
     */
    async handleDailyConnection(citizenId: string): Promise<void> {
        const citizen = await this.citizenRepository.findOne({ where: { id: citizenId } });
        if (!citizen) return;

        const now = new Date();
        const lastConnection = citizen.lastConnectionDate;

        if (lastConnection) {
            const lastConnectionUTC = new Date(Date.UTC(
                lastConnection.getUTCFullYear(),
                lastConnection.getUTCMonth(),
                lastConnection.getUTCDate()
            ));
            const todayUTC = new Date(Date.UTC(
                now.getUTCFullYear(),
                now.getUTCMonth(),
                now.getUTCDate()
            ));

            if (lastConnectionUTC.getTime() === todayUTC.getTime()) {
                // Déjà connecté aujourd'hui
                return;
            }

            // Vérifier si la connexion est consécutive (hier)
            const yesterdayUTC = new Date(todayUTC);
            yesterdayUTC.setUTCDate(yesterdayUTC.getUTCDate() - 1);

            if (lastConnectionUTC.getTime() === yesterdayUTC.getTime()) {
                citizen.consecutiveConnectionDays += 1;
            } else {
                citizen.consecutiveConnectionDays = 1;
            }
        } else {
            citizen.consecutiveConnectionDays = 1;
        }

        citizen.lastConnectionDate = now;

        let bonusXP = GameConstants.XP.DAILY_LOGIN;

        // Bonus pour une semaine complète de connexion
        if (citizen.consecutiveConnectionDays === GameConstants.STREAKS.DAILY_CYCLE) {
            bonusXP += GameConstants.XP.DAILY_STREAK_BONUS;
            this.logger.log(`🔥 Streak 7 jours de connexion ! +${GameConstants.XP.DAILY_STREAK_BONUS} XP`);
            citizen.consecutiveConnectionDays = 0;
        }

        await this.citizenRepository.save(citizen);
        await this.addXP(citizenId, bonusXP, 'Connexion quotidienne');
    }

    /**
     * Attribue un bonus pour l'anniversaire d'inscription (1 an).
     */
    async checkAnniversary(citizenId: string): Promise<void> {
        const citizen = await this.citizenRepository.findOne({
            where: { id: citizenId },
            relations: ['user'],
        });

        if (!citizen || !citizen.user) return;

        if (citizen.achievedMilestones['1_year_anniversary']) return;

        const createdAt = citizen.user.createdAt;
        if (!createdAt) return;

        const now = new Date();
        const oneYearAgo = new Date(now);
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        if (createdAt <= oneYearAgo) {
            citizen.achievedMilestones['1_year_anniversary'] = true;
            await this.citizenRepository.save(citizen);
            await this.addXP(citizenId, GameConstants.XP.ANNIVERSARY_1_YEAR, 'Anniversaire 1 an');
        }
    }

    /**
     * Détermine le niveau (numeric) correspondant à un montant d'XP donné.
     * Parcourt la table des niveaux du plus haut vers le plus bas.
     */
    async calculateLevel(xp: number): Promise<number> {
        const levels = await this.levelRepository.find({ order: { level: 'DESC' } });

        for (const level of levels) {
            if (xp >= level.xpRequired) {
                return level.level;
            }
        }

        return GameConstants.LEVELS.DEFAULT;
    }

    /**
     * Récupère un état complet de la progression du citoyen pour le Frontend.
     * @param citizenId UUID du citoyen
     * @returns Object contenant XP, niveau, progression vers le prochain niveau, etc.
     */
    async getCitizenProgress(citizenId: string) {
        const citizen = await this.citizenRepository.findOne({ where: { id: citizenId } });
        if (!citizen) {
            throw new Error('Citizen not found');
        }

        const currentLevelData = await this.levelRepository.findOne({
            where: { level: citizen.currentLevel },
        });

        const nextLevelData = await this.levelRepository.findOne({
            where: { level: citizen.currentLevel + 1 },
        });

        const currentXP = citizen.xp;
        const currentLevelXP = currentLevelData?.xpRequired || 0;
        const nextLevelXP = nextLevelData?.xpRequired || currentLevelXP;

        const xpInCurrentLevel = currentXP - currentLevelXP;
        const xpNeededForNextLevel = nextLevelXP - currentLevelXP;
        const progressPercentage = nextLevelData
            ? (xpInCurrentLevel / xpNeededForNextLevel) * 100
            : 100;

        return {
            currentLevel: citizen.currentLevel,
            levelName: currentLevelData?.name || 'Observateur',
            badge: currentLevelData?.badge || '👁️',
            currentXP: citizen.xp,
            currentLevelXP: currentLevelXP,
            nextLevelXP: nextLevelData?.xpRequired || null,
            progressPercentage: Math.min(progressPercentage, 100),
            totalVotes: citizen.totalVotes,
            consecutiveDays: citizen.consecutiveConnectionDays,
            weeklyStreak: citizen.weeklyVoteStreak,
        };
    }
}
