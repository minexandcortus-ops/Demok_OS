import { Controller, Get, UseGuards, NotFoundException } from '@nestjs/common';
import { GamificationService } from './gamification.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Citizen } from '../users/citizen.entity';
import { CitizenLevel } from './entities/citizen-level.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/get-user.decorator';
import { User } from '../users/user.entity';

@Controller('gamification')
export class GamificationController {
    constructor(
        private readonly gamificationService: GamificationService,
        @InjectRepository(Citizen)
        private readonly citizenRepository: Repository<Citizen>,
        @InjectRepository(CitizenLevel)
        private readonly levelRepository: Repository<CitizenLevel>,
    ) { }

    /**
     * GET /gamification/progress
     * Récupère la progression du citoyen connecté
     */
    @Get('progress')
    @UseGuards(JwtAuthGuard)
    async getProgress(@CurrentUser() user: User) {
        const citizen = await this.citizenRepository.findOne({
            where: { user: { id: user.id } },
        });

        if (!citizen) {
            throw new NotFoundException('Citizen not found');
        }

        return this.gamificationService.getCitizenProgress(citizen.id);
    }

    /**
     * GET /gamification/levels
     * Liste tous les niveaux disponibles
     */
    @Get('levels')
    async getAllLevels() {
        const levels = await this.levelRepository.find({
            order: { level: 'ASC' },
        });

        return levels.map(level => ({
            level: level.level,
            name: level.name,
            badge: level.badge,
            xpRequired: level.xpRequired,
        }));
    }
}
