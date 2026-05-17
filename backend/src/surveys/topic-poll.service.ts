import { Injectable, OnModuleInit, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TopicPoll } from './topic-poll.entity';
import { SurveyRegistry } from './survey-registry.entity';
import { SurveyUrna } from './survey-urna.entity';
import { Citizen } from '../users/citizen.entity';
import * as crypto from 'crypto';

@Injectable()
export class TopicPollService implements OnModuleInit {
    private readonly logger = new Logger(TopicPollService.name);

    constructor(
        @InjectRepository(TopicPoll)
        private readonly pollRepository: Repository<TopicPoll>,
        @InjectRepository(SurveyRegistry)
        private readonly registryRepository: Repository<SurveyRegistry>,
        @InjectRepository(SurveyUrna)
        private readonly urnaRepository: Repository<SurveyUrna>,
        @InjectRepository(Citizen)
        private readonly citizenRepository: Repository<Citizen>,
    ) { }

    async onModuleInit() {
        await this.seedInitialPolls();
    }

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

    private async seedInitialPolls() {
        const polls = [
            {
                slug: 'guerre-iran-2026',
                question: 'Guerre en Iran',
                description: 'Êtes-vous favorable à une intervention militaire de la France ou de ses alliés en Iran ?',
            },
            {
                slug: 'rearmement-europe-2026',
                question: 'Réarmement de l\'Europe',
                description: 'Êtes-vous favorable à une augmentation significative des budgets de défense des pays européens face aux nouvelles menaces géopolitiques ?',
            },
        ];

        for (const poll of polls) {
            const existing = await this.pollRepository.findOne({ where: { slug: poll.slug } });
            if (!existing) {
                await this.pollRepository.save({
                    ...poll,
                    votePour: 0,
                    voteNeutre: 0,
                    voteContre: 0,
                    voters: '',
                    isActive: true,
                });
                this.logger.log(`✅ Sondage "${poll.question}" créé.`);
            }
        }
    }

    async getPolls(): Promise<any[]> {
        const polls = await this.pollRepository.find({ where: { isActive: true } });
        return Promise.all(polls.map(p => this.toResult(p)));
    }

    async getPoll(slug: string): Promise<any> {
        const poll = await this.pollRepository.findOneOrFail({ where: { slug } });
        return this.toResult(poll);
    }

    async vote(slug: string, userId: string, choice: 'pour' | 'neutre' | 'contre') {
        const poll = await this.pollRepository.findOne({ where: { slug } });
        if (!poll) throw new NotFoundException('Sondage introuvable');

        const citizen = await this.citizenRepository.findOne({ 
            where: { user: { id: userId } } 
        });
        if (!citizen) throw new NotFoundException('Profil citoyen introuvable');

        // Check already voted (Old system or New system)
        const hasVoted = await this.hasVoted(slug, userId);
        if (hasVoted) {
            return { alreadyVoted: true, poll: await this.toResult(poll) };
        }

        // New Anonymized Vote Process
        const voterToken = this.generateVoterToken(citizen.id, poll.id);

        // 1. Save to Registry
        const newRegistry = new SurveyRegistry();
        newRegistry.citizen = citizen;
        newRegistry.surveyId = poll.id;
        newRegistry.surveyType = 'TOPIC';
        await this.registryRepository.save(newRegistry);

        // 2. Save to Urna
        const newChoice = new SurveyUrna();
        newChoice.surveyId = poll.id;
        newChoice.voterToken = voterToken;
        newChoice.choiceId = choice; // 'pour', 'neutre' or 'contre'
        await this.urnaRepository.save(newChoice);

        return { alreadyVoted: false, poll: await this.toResult(poll) };
    }

    async hasVoted(slug: string, userId: string): Promise<boolean> {
        const poll = await this.pollRepository.findOne({ where: { slug } });
        if (!poll) return false;

        // 1. Check legacy system (voters string)
        const voters = poll.voters ? poll.voters.split(',').filter(Boolean) : [];
        if (voters.includes(userId)) return true;

        // 2. Check new anonymized system (Registry)
        const citizen = await this.citizenRepository.findOne({ 
            where: { user: { id: userId } } 
        });
        if (!citizen) return false;

        const registryEntry = await this.registryRepository.findOne({
            where: { citizen: { id: citizen.id }, surveyId: poll.id }
        });

        return !!registryEntry;
    }

    async toResult(poll: TopicPoll) {
        // Count from new anonymized system
        const newVotes = await this.urnaRepository.find({ where: { surveyId: poll.id } });
        
        const newCounts = {
            pour: newVotes.filter(v => v.choiceId === 'pour').length,
            neutre: newVotes.filter(v => v.choiceId === 'neutre').length,
            contre: newVotes.filter(v => v.choiceId === 'contre').length,
        };

        const totalPour = poll.votePour + newCounts.pour;
        const totalNeutre = poll.voteNeutre + newCounts.neutre;
        const totalContre = poll.voteContre + newCounts.contre;
        const total = totalPour + totalNeutre + totalContre;

        return {
            id: poll.id,
            slug: poll.slug,
            question: poll.question,
            description: poll.description,
            totalVotes: total,
            results: [
                { choice: 'pour', label: 'Pour', votes: totalPour, percentage: total > 0 ? (totalPour / total) * 100 : 0 },
                { choice: 'neutre', label: 'Neutre', votes: totalNeutre, percentage: total > 0 ? (totalNeutre / total) * 100 : 0 },
                { choice: 'contre', label: 'Contre', votes: totalContre, percentage: total > 0 ? (totalContre / total) * 100 : 0 },
            ],
        };
    }
}
