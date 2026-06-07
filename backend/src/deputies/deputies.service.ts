import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Deputy } from '../votes/deputy.entity';
import { OfficialVote } from '../votes/official-vote.entity';
import { Citizen } from '../users/citizen.entity';

@Injectable()
export class DeputiesService {
    constructor(
        @InjectRepository(Deputy)
        private readonly deputyRepository: Repository<Deputy>,
        @InjectRepository(OfficialVote)
        private readonly officialVoteRepository: Repository<OfficialVote>,
        @InjectRepository(Citizen)
        private readonly citizenRepository: Repository<Citizen>,
    ) {}

    async searchDeputies(query: string, sortBy: string = 'name_asc', limit: number = 20, offset: number = 0, userId?: string) {
        let where: any = {};
        if (query) {
            where = [
                { fullName: ILike(`%${query}%`) },
                { constituencyCode: ILike(`%${query}%`) },
                { department: ILike(`%${query}%`) },
            ];
        }

        let order: any = { lastName: 'ASC', fullName: 'ASC' };
        if (sortBy === 'party_asc') {
            order = { party: 'ASC', fullName: 'ASC' };
        } else if (sortBy === 'dept_asc') {
            order = { department: 'ASC', fullName: 'ASC' };
        }

        let userConstituencyCode: string | null = null;
        if (userId) {
            const citizen = await this.citizenRepository.findOne({
                where: { user: { id: userId } },
                relations: ['constituency'],
            });
            if (citizen && citizen.constituency) {
                userConstituencyCode = citizen.constituency.code;
            }
        }

        const qb = this.deputyRepository.createQueryBuilder('deputy')
            .where('deputy.isActive = :isActive', { isActive: true });
        
        if (query) {
            qb.andWhere('(deputy.fullName ILIKE :q OR deputy.constituencyCode ILIKE :q OR deputy.department ILIKE :q)', { q: `%${query}%` });
        }

        if (userConstituencyCode) {
            // Le député de l'utilisateur remonte en premier
            qb.addOrderBy(`CASE WHEN deputy.constituencyCode = :myCode THEN 0 ELSE 1 END`, 'ASC');
            qb.setParameter('myCode', userConstituencyCode);
        }

        // Apply remaining sort
        if (sortBy === 'party_asc') {
            qb.addOrderBy('deputy.party', 'ASC');
        } else if (sortBy === 'dept_asc') {
            qb.addOrderBy('deputy.department', 'ASC');
        }
        qb.addOrderBy('deputy.lastName', 'ASC');
        qb.addOrderBy('deputy.fullName', 'ASC');

        qb.take(limit).skip(offset);

        const [deputies, total] = await qb.getManyAndCount();

        return { deputies, total };
    }

    async getDeputyById(id: string) {
        const deputy = await this.deputyRepository.findOne({ where: { id } });
        if (!deputy) throw new NotFoundException('Deputy not found');
        return deputy;
    }

    async getDeputyVotes(id: string, limit: number = 5) {
        const deputy = await this.deputyRepository.findOne({ where: { id } });
        if (!deputy) {
            return [];
        }

        const slug = deputy.fullName
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
            
        try {
            const response = await fetch(`https://clair-production.up.railway.app/api/v1/deputes/${slug}/votes?limit=50`, {
                headers: {
                    'User-Agent': 'Demok-Backend/1.0 (contact@demok.fr)'
                }
            });
            if (response.ok) {
                const json = await response.json();
                if (json.data && Array.isArray(json.data)) {
                    // Filtrer pour ne garder que les votes majeurs (ensemble, article unique, motions...)
                    const filteredVotes = json.data.filter((v: any) => {
                        const title = v.scrutin?.titre?.toLowerCase() || '';
                        return !title.includes('amendement') && !title.match(/article \d+/i);
                    });
                    
                    const clairVotes = filteredVotes.slice(0, limit);
                    return clairVotes.map((v: any) => ({
                        id: v.id,
                        lawId: v.scrutin.id,
                        lawTitle: v.scrutin.titre,
                        choice: v.position,
                        voteDate: v.scrutin.date,
                        scrutinId: v.scrutin.numero?.toString(),
                    }));
                }
            }
        } catch (e) {
            console.error("Erreur lors de la récupération des votes CLAIR:", e);
        }

        return [];
    }

    async getDeputyStats(id: string) {
        const deputy = await this.deputyRepository.findOne({ where: { id } });
        if (!deputy) return null;

        const slug = deputy.fullName
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
            
        try {
            const response = await fetch(`https://clair-production.up.railway.app/api/v1/deputes/${slug}`, {
                headers: {
                    'User-Agent': 'Demok-Backend/1.0 (contact@demok.fr)'
                }
            });
            if (response.ok) {
                const json = await response.json();
                if (json.data) {
                    return {
                        loyaute: json.data.statsLoyaute,
                        presenceMoyenne: json.data.statsPresenceMoyenne,
                        presenceWeeks: json.data.statsPresence,
                        votesCount: json.data.statsParticipation,
                    };
                }
            }
        } catch (e) {
            console.error("Erreur lors de la récupération des stats CLAIR:", e);
        }
        return null;
    }
}
