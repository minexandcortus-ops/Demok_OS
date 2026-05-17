import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { IngestionSchedulerService } from '../scheduler/ingestion-scheduler.service';

/**
 * Script pour déclencher manuellement le CRON job de synchronisation complète.
 * Usage: npx ts-node src/scripts/manual-cron.ts
 */
async function bootstrap() {
    console.log('🚀 Démarrage manuel du CRON Job DéMoK...');
    
    const app = await NestFactory.createApplicationContext(AppModule, { 
        logger: ['error', 'warn', 'log', 'debug'] 
    });
    
    try {
        const schedulerService = app.get(IngestionSchedulerService);
        await schedulerService.handleDailySync();
        console.log('✅ Synchronisation terminée avec succès !');
    } catch (err) {
        console.error('❌ Erreur lors de la synchronisation:', err);
    } finally {
        await app.close();
        process.exit(0);
    }
}

bootstrap();
