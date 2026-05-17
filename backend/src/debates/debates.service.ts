
import { Injectable, Logger, BadRequestException, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Opinion } from './entities/opinion.entity';
import { OpinionMoke } from './entities/opinion-moke.entity';
import { OpinionReport } from './entities/opinion-report.entity';
import { Citizen } from '../users/citizen.entity';
import { Law } from '../laws/law.entity';

@Injectable()
export class DebatesService {
    private readonly logger = new Logger(DebatesService.name);
    // Niveau requis : Citoyen Actif (Niveau 5)
    // TODO: Récupérer dynamiquement si possible, mais hardcodé pour l'instant comme validé.
    private readonly REQUIRED_LEVEL = 3;

    constructor(
        @InjectRepository(Opinion)
        private opinionRepository: Repository<Opinion>,
        @InjectRepository(OpinionMoke)
        private mokeRepository: Repository<OpinionMoke>,
        @InjectRepository(OpinionReport)
        private reportRepository: Repository<OpinionReport>,
        @InjectRepository(Citizen)
        private citizenRepository: Repository<Citizen>,
        @InjectRepository(Law)
        private lawRepository: Repository<Law>,
    ) { }

    /**
     * Retourne les lois les plus actives dans les débats (par nb d'opinions)
     * avec les infos essentielles pour afficher un feed dans l'onglet Débats
     */
    async getActiveLaws(limit: number = 20): Promise<any[]> {
        // 1. Récupérer le compte d'opinions par loi
        const opinionCounts = await this.opinionRepository
            .createQueryBuilder('opinion')
            .select('opinion.lawId', 'lawId')
            .addSelect('COUNT(opinion.id)', 'opinionCount')
            .groupBy('opinion.lawId')
            .getRawMany();

        // Construire une map lawId -> opinionCount
        const countMap = new Map<string, number>();
        opinionCounts.forEach(r => countMap.set(r.lawId, parseInt(r.opinionCount, 10)));

        // 2. Récupérer TOUTES les lois, triées par nombre d'opinions DESC puis par date de vote DESC
        const laws = await this.lawRepository.find({
            relations: ['categories'],
            order: { agendaDate: 'DESC' },
            take: limit,
        });

        // 3. Enrichir chaque loi avec son opinionCount (0 si aucun commentaire)
        const enriched = laws.map(law => ({
            ...law,
            opinionCount: countMap.get(law.id) ?? 0,
        }));

        // 4. Trier : les lois avec le plus de commentaires en premier, puis par date
        enriched.sort((a, b) => b.opinionCount - a.opinionCount);

        return enriched;
    }



    /**
     * Poster un avis sur une loi
     */
    async createOpinion(userId: string, lawId: string, content: string): Promise<Opinion> {
        // 1. Vérifier le niveau du citoyen
        const citizen = await this.citizenRepository.findOne({ where: { user: { id: userId } } });
        if (!citizen) {
            throw new ForbiddenException('Profil citoyen introuvable.');
        }

        if (citizen.currentLevel < this.REQUIRED_LEVEL) {
            throw new ForbiddenException(`Niveau "Citoyen Éveillé" (Niveau ${this.REQUIRED_LEVEL}) requis pour débattre.`);
        }


        // 3. Validation contenu
        if (content.length > 160) {
            throw new BadRequestException('L\'avis ne doit pas dépasser 160 caractères.');
        }

        // 4. Créer l'avis
        const opinion = this.opinionRepository.create({
            userId,
            lawId,
            content,
            mokes: 0,
        });

        const saved = await this.opinionRepository.save(opinion);

        // Retourner avec les infos user pour l'affichage immédiat
        return this.opinionRepository.findOne({
            where: { id: saved.id },
            relations: ['user']
        });
    }

    /**
     * Récupérer les avis d'une loi avec tri
     */
    async getOpinions(lawId: string, userId: string | null, sortBy: 'recent' | 'popular' = 'recent'): Promise<any[]> {
        const qb = this.opinionRepository.createQueryBuilder('opinion')
            .leftJoinAndSelect('opinion.user', 'user') // Pour afficher le pseudo/badge
            .leftJoinAndSelect('opinion.mokesList', 'moke', 'moke.userId = :userId', { userId }) // Pour savoir si user a moké
            .where('opinion.lawId = :lawId', { lawId });

        if (sortBy === 'popular') {
            qb.orderBy('opinion.mokes', 'DESC');
            qb.addOrderBy('opinion.createdAt', 'DESC');
        } else {
            qb.orderBy('opinion.createdAt', 'DESC');
        }

        const opinions = await qb.getMany();

        // Bulk fetch all author citizen profiles (avoids N+1 queries)
        const authorIds = [...new Set(opinions.map(op => op.userId))];
        const authorCitizens = authorIds.length > 0
            ? await this.citizenRepository.find({
                  where: { user: { id: In(authorIds) } },
                  relations: ['user'],
              })
            : [];
        const citizenMap = new Map(authorCitizens.map(c => [c.user.id, c]));

        // Map for the frontend (include hasMoked)
        return opinions.map(op => {
            const hasMoked = !!op.mokesList?.length;
            const authorCitizen = citizenMap.get(op.userId);

            return {
                id: op.id,
                content: op.content,
                mokes: op.mokes,
                createdAt: op.createdAt,
                hasMoked: hasMoked,
                author: {
                    id: op.userId,
                    pseudo: authorCitizen?.pseudo || 'Citoyen masqué',
                    level: authorCitizen?.currentLevel || 1,
                },
            };
        });
    }

    /**
     * Modifier son propre avis
     */
    async updateOpinion(userId: string, opinionId: string, content: string): Promise<any> {
        const opinion = await this.opinionRepository.findOne({ where: { id: opinionId } });
        if (!opinion) {
            throw new NotFoundException('Avis introuvable');
        }
        if (opinion.userId !== userId) {
            throw new ForbiddenException('Vous ne pouvez modifier que vos propres avis.');
        }
        if (content.length > 160) {
            throw new BadRequestException('L\'avis ne doit pas dépasser 160 caractères.');
        }
        opinion.content = content;
        const saved = await this.opinionRepository.save(opinion);

        // Fetch citizen for author info
        const citizen = await this.citizenRepository.findOne({ where: { user: { id: userId } } });
        return {
            id: saved.id,
            content: saved.content,
            mokes: saved.mokes,
            createdAt: saved.createdAt,
            hasMoked: false,
            author: {
                id: userId,
                pseudo: citizen?.pseudo || 'Citoyen',
                level: citizen?.currentLevel || 1,
            },
        };
    }

    /**
     * Moker (Liker) ou Démoker un avis
     */
    async toggleMoke(userId: string, opinionId: string): Promise<{ mokes: number, hasMoked: boolean }> {
        const opinion = await this.opinionRepository.findOne({ where: { id: opinionId } });
        if (!opinion) {
            throw new NotFoundException('Avis introuvable');
        }

        const existingMoke = await this.mokeRepository.findOne({ where: { userId, opinionId } });

        if (existingMoke) {
            // Remove Moke
            await this.mokeRepository.remove(existingMoke);
            opinion.mokes = Math.max(0, opinion.mokes - 1);
            await this.opinionRepository.save(opinion);
            return { mokes: opinion.mokes, hasMoked: false };
        } else {
            // Add Moke
            const moke = this.mokeRepository.create({ userId, opinionId });
            await this.mokeRepository.save(moke);
            opinion.mokes += 1;
            await this.opinionRepository.save(opinion);
            return { mokes: opinion.mokes, hasMoked: true };
        }
    }

    /**
     * Admin: Récupérer tous les avis
     */
    async findAllForAdmin(q?: string, limit: number = 50, offset: number = 0, onlyReported: boolean = false): Promise<[Opinion[], number]> {
        const qb = this.opinionRepository.createQueryBuilder('opinion')
            .leftJoinAndSelect('opinion.user', 'user')
            .leftJoinAndSelect('opinion.law', 'law')
            .leftJoinAndSelect('opinion.reportsList', 'reportsList')
            .orderBy('opinion.createdAt', 'DESC');

        if (q) {
            qb.andWhere('opinion.content ILIKE :q', { q: `%${q}%` });
        }

        if (onlyReported) {
            // Inner join or where exists to filter only opinions with at least one report
            qb.innerJoin('opinion.reportsList', 'reportsFilter');
        }

        qb.take(limit).skip(offset);

        return qb.getManyAndCount();
    }

    /**
     * Admin: Supprimer un avis
     */
    async deleteOpinion(id: string): Promise<void> {
        const opinion = await this.opinionRepository.findOne({ where: { id } });
        if (!opinion) {
            throw new NotFoundException('Avis introuvable');
        }
        await this.opinionRepository.remove(opinion);
    }

    /**
     * Signaler un avis
     */
    async reportOpinion(userId: string, opinionId: string, reason?: string): Promise<void> {
        const opinion = await this.opinionRepository.findOne({ where: { id: opinionId } });
        if (!opinion) {
            throw new NotFoundException('Avis introuvable');
        }

        const existingReport = await this.reportRepository.findOne({ where: { userId, opinionId } });
        if (existingReport) {
            throw new ConflictException('Vous avez déjà signalé cet avis.');
        }

        const report = this.reportRepository.create({
            userId,
            opinionId,
            reason
        });

        await this.reportRepository.save(report);
        this.logger.log(`⚠️ Avis ${opinionId} signalé par l'utilisateur ${userId}`);
    }
}
