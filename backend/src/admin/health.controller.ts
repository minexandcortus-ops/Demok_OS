import { Controller, Get, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Law } from '../laws/law.entity';
import { ConfigService } from '@nestjs/config';

/**
 * Endpoint de monitoring pour vérifier l'état du système
 */
@Controller('admin/health')
export class HealthController {
    private readonly logger = new Logger(HealthController.name);

    constructor(
        @InjectRepository(Law)
        private lawRepository: Repository<Law>,
        private configService: ConfigService,
    ) { }

    /**
     * Endpoint de santé du système
     * GET /admin/health
     */
    @Get()
    async getHealth() {
        this.logger.log('📊 Vérification santé du système');

        try {
            // Compter les lois
            const lawsCount = await this.lawRepository.count();

            // Trouver la dernière synchronisation
            const lastLaw = await this.lawRepository.findOne({
                where: {},
                order: { lastModifiedAt: 'DESC' },
            });

            // Vérifier les services
            const mistralConfigured = !!this.configService.get<string>('MISTRAL_API_KEY');
            const redisConfigured = !!this.configService.get<string>('REDIS_URL');

            const health = {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                services: {
                    database: {
                        status: 'connected',
                        lawsCount,
                    },
                    mistralAI: {
                        status: mistralConfigured ? 'configured' : 'not_configured',
                        model: this.configService.get<string>('MISTRAL_MODEL', 'mistral-small-latest'),
                    },
                    redis: {
                        status: redisConfigured ? 'configured' : 'not_configured',
                    },
                },
                lastSync: lastLaw?.lastModifiedAt || null,
                uptime: process.uptime(),
                memory: {
                    used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                    total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
                    unit: 'MB',
                },
            };

            return health;

        } catch (error) {
            this.logger.error(`❌ Erreur health check: ${error.message}`);

            return {
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                error: error.message,
            };
        }
    }
}
