import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CitizenLevel } from '../entities/citizen-level.entity';

@Injectable()
export class LevelsSeedService implements OnModuleInit {
    private readonly logger = new Logger(LevelsSeedService.name);

    constructor(
        @InjectRepository(CitizenLevel)
        private readonly levelRepository: Repository<CitizenLevel>,
    ) { }

    async onModuleInit() {
        await this.seedLevels();
    }

    private async seedLevels() {
        const count = await this.levelRepository.count();

        if (count > 0) {
            this.logger.log('Citizen levels already seeded');
            return;
        }

        const levels = [
            { level: 1, name: 'Observateur', badge: '👁️', xpRequired: 0 },
            { level: 2, name: 'Citoyen Curieux', badge: '🔍', xpRequired: 100 },
            { level: 3, name: 'Citoyen Éveillé', badge: '🌱', xpRequired: 300 },
            { level: 4, name: 'Citoyen Investi', badge: '📍', xpRequired: 600 },
            { level: 5, name: 'Citoyen Actif', badge: '⚡', xpRequired: 1000 },
            { level: 6, name: 'Citoyen Assidu', badge: '🎯', xpRequired: 1600 },
            { level: 7, name: 'Citoyen Engagé', badge: '💪', xpRequired: 2500 },
            { level: 8, name: 'Citoyen Éclairé', badge: '💡', xpRequired: 4000 },
            { level: 9, name: 'Citoyen Exemplaire', badge: '⭐', xpRequired: 6000 },
            { level: 10, name: 'Pilier Citoyen', badge: '🏛️', xpRequired: 9000 },
            { level: 11, name: 'Ambassadeur Civique', badge: '🎖️', xpRequired: 13000 },
            { level: 12, name: 'Héro Citoyen', badge: '🦸', xpRequired: 18000 },
            { level: 13, name: 'Légende Citoyenne', badge: '🌟', xpRequired: 25000 },
            { level: 14, name: 'Sage de la République', badge: '🦉', xpRequired: 35000 },
            { level: 15, name: 'Gardien de la Démocratie', badge: '🛡️', xpRequired: 50000 },
        ];

        for (const levelData of levels) {
            const level = this.levelRepository.create(levelData);
            await this.levelRepository.save(level);
        }

        this.logger.log('Successfully seeded 15 citizen levels');
    }
}
