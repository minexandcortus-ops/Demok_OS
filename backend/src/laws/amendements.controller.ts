import { Controller, Get, Param, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Amendement, AmendementStatut } from './amendement.entity';

@Controller()
export class AmendementsController {
    constructor(
        @InjectRepository(Amendement)
        private amendementRepository: Repository<Amendement>,
    ) { }

    /**
     * GET /laws/:lawId/amendements
     * Liste les amendements d'une loi avec filtre optionnel par statut
     */
    @Get('laws/:lawId/amendements')
    async getAmendements(
        @Param('lawId') lawId: string,
        @Query('statut') statut?: string,
        @Query('page') page: string = '1',
        @Query('limit') limit: string = '20',
    ) {
        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));

        const queryBuilder = this.amendementRepository
            .createQueryBuilder('amendement')
            .where('amendement.lawId = :lawId', { lawId });

        if (statut && Object.values(AmendementStatut).includes(statut as AmendementStatut)) {
            queryBuilder.andWhere('amendement.statut = :statut', { statut });
        }

        queryBuilder
            .orderBy('amendement.numero', 'ASC')
            .skip((pageNum - 1) * limitNum)
            .take(limitNum);

        const [items, total] = await queryBuilder.getManyAndCount();

        return {
            items,
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum),
        };
    }

    /**
     * GET /laws/:lawId/amendements/stats
     * Stats des amendements d'une loi (nb par statut)
     */
    @Get('laws/:lawId/amendements/stats')
    async getAmendementsStats(@Param('lawId') lawId: string) {
        const stats = await this.amendementRepository
            .createQueryBuilder('amendement')
            .select('amendement.statut', 'statut')
            .addSelect('COUNT(*)', 'count')
            .where('amendement.lawId = :lawId', { lawId })
            .groupBy('amendement.statut')
            .getRawMany();

        const total = stats.reduce((sum, s) => sum + parseInt(s.count), 0);

        return {
            lawId,
            total,
            parStatut: stats.reduce((acc, s) => {
                acc[s.statut] = parseInt(s.count);
                return acc;
            }, {} as Record<string, number>),
        };
    }

    /**
     * GET /amendements/:id
     * Détail d'un amendement
     */
    @Get('amendements/:id')
    async getAmendement(@Param('id') id: string) {
        const amendement = await this.amendementRepository.findOne({
            where: { id },
            relations: ['law'],
        });

        if (!amendement) {
            return { error: 'Amendement non trouvé', statusCode: 404 };
        }

        return amendement;
    }
}
