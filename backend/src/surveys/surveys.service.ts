import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Candidate } from './candidate.entity';
import { PresidentialVote } from './presidential-vote.entity';
import { User } from '../users/user.entity';
import { Citizen } from '../users/citizen.entity';
import { SurveyRegistry } from './survey-registry.entity';
import { SurveyUrna } from './survey-urna.entity';
import * as crypto from 'crypto';

@Injectable()
export class SurveysService {
    private readonly PRESIDENTIAL_SURVEY_ID = 'PRESIDENTIAL_2027';

    constructor(
        @InjectRepository(Candidate)
        private readonly candidateRepository: Repository<Candidate>,
        @InjectRepository(PresidentialVote)
        private readonly oldVoteRepository: Repository<PresidentialVote>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(Citizen)
        private readonly citizenRepository: Repository<Citizen>,
        @InjectRepository(SurveyRegistry)
        private readonly registryRepository: Repository<SurveyRegistry>,
        @InjectRepository(SurveyUrna)
        private readonly urnaRepository: Repository<SurveyUrna>,
    ) { }

    /**
     * Gère l'anonymisation du vote par hachage cryptographique.
     */
    private generateVoterToken(citizenId: string, surveyId: string): string {
        const secret = process.env.VOTE_SECRET;
        if (!secret) {
            throw new Error('VOTE_SECRET environment variable is not defined');
        }
        return crypto
            .createHmac('sha256', secret)
            .update(`${citizenId}:${surveyId}`)
            .digest('hex');
    }

    /**
     * Get all presidential candidates ordered alphabetically by name
     */
    async getCandidates(): Promise<Candidate[]> {
        return this.candidateRepository.find({
            order: { name: 'ASC' }
        });
    }

    /**
     * Vote for a candidate (Anonymized)
     * Returns the vote results with percentages
     */
    async vote(userId: string, candidateId: string) {
        // 1. Get citizen profile
        const citizen = await this.citizenRepository.findOne({ 
            where: { user: { id: userId } } 
        });
        const candidate = await this.candidateRepository.findOne({ 
            where: { id: candidateId } 
        });

        if (!citizen || !candidate) {
            throw new NotFoundException('Citoyen ou candidat introuvable');
        }

        const surveyId = this.PRESIDENTIAL_SURVEY_ID;
        const voterToken = this.generateVoterToken(citizen.id, surveyId);

        // 2. Check if user already voted (Registry)
        const registryEntry = await this.registryRepository.findOne({
            where: { citizen: { id: citizen.id }, surveyId }
        });

        if (registryEntry) {
            // Update existing anonymized choice in Urna
            let choiceEntry = await this.urnaRepository.findOne({ 
                where: { voterToken, surveyId } 
            });
            
            if (choiceEntry) {
                choiceEntry.choiceId = candidateId;
                await this.urnaRepository.save(choiceEntry);
            } else {
                // Should not happen if registry exists, but for safety:
                const newChoice = new SurveyUrna();
                newChoice.surveyId = surveyId;
                newChoice.voterToken = voterToken;
                newChoice.choiceId = candidateId;
                await this.urnaRepository.save(newChoice);
            }
        } else {
            // First time voting
            
            // a. Save to Registry (to prevent double vote)
            const newRegistry = new SurveyRegistry();
            newRegistry.citizen = citizen;
            newRegistry.surveyId = surveyId;
            newRegistry.surveyType = 'PRESIDENTIAL';
            await this.registryRepository.save(newRegistry);

            // b. Save to Urna (anonymized choice)
            const newChoice = new SurveyUrna();
            newChoice.surveyId = surveyId;
            newChoice.voterToken = voterToken;
            newChoice.choiceId = candidateId;
            await this.urnaRepository.save(newChoice);
        }

        // Return updated results
        return this.getResults();
    }

    /**
     * Get voting results with percentages (Aggregating old and new systems)
     */
    async getResults() {
        const candidates = await this.candidateRepository.find({
            order: { name: 'ASC' }
        });

        // Total = old votes + new anonymized votes
        const oldTotal = await this.oldVoteRepository.count();
        const newTotal = await this.urnaRepository.count({ 
            where: { surveyId: this.PRESIDENTIAL_SURVEY_ID } 
        });
        const totalVotes = oldTotal + newTotal;

        const results = await Promise.all(
            candidates.map(async (candidate) => {
                // Count from old table
                const oldVotes = await this.oldVoteRepository.count({
                    where: { candidate: { id: candidate.id } }
                });

                // Count from new anonymized urna
                const newVotes = await this.urnaRepository.count({
                    where: { surveyId: this.PRESIDENTIAL_SURVEY_ID, choiceId: candidate.id }
                });

                const totalCandidateVotes = oldVotes + newVotes;

                return {
                    candidateId: candidate.id,
                    name: candidate.name,
                    party: candidate.party,
                    photoUrl: candidate.photoUrl,
                    votes: totalCandidateVotes,
                    percentage: totalVotes > 0 ? (totalCandidateVotes / totalVotes) * 100 : 0
                };
            })
        );

        return {
            totalVotes,
            results
        };
    }

    /**
     * Check if a user has already voted (Checks both systems)
     */
    async hasVoted(userId: string): Promise<boolean> {
        const citizen = await this.citizenRepository.findOne({ 
            where: { user: { id: userId } } 
        });
        if (!citizen) return false;

        // Check old table
        const oldVote = await this.oldVoteRepository.findOne({
            where: { user: { id: userId } }
        });
        if (oldVote) return true;

        // Check new registry
        const registryEntry = await this.registryRepository.findOne({
            where: { citizen: { id: citizen.id }, surveyId: this.PRESIDENTIAL_SURVEY_ID }
        });
        
        return !!registryEntry;
    }
}
