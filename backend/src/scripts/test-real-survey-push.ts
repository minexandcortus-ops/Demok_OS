import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { NotificationProcessor } from '../notifications/notification.processor';

/**
 * Script pour simuler la publication d'un nouveau sondage (Bypass Redis/Bull queue)
 * Usage: npx ts-node src/scripts/test-real-survey-push.ts
 */
async function bootstrap() {
    console.log('🚀 Simulation de la création d\'un nouveau sondage...');
    
    const app = await NestFactory.createApplicationContext(AppModule, { 
        logger: ['error', 'warn'] // Moins de logs pour voir plus clair
    });
    
    try {
        console.log('⏳ Connexion à la base de données... Recherche des citoyens abonnés...');
        // On récupère le processeur directement pour bypasser Redis (qui n'est pas installé en local)
        const processor = app.get(NotificationProcessor);

        // On simule l'action du job "new-survey"
        await processor.handleNewSurvey({
            data: {
                pollId: "fake-poll-id-1234",
                question: "Êtes-vous pour la semaine de 4 jours en entreprise ?"
            }
        } as any);

        console.log('✅ Sondage simulé ! La notification "Nouveau Sondage" vient d\'être envoyée.');
        console.log('📱 Regardez votre téléphone, il devrait sonner d\'ici quelques secondes !');
    } catch (error) {
        console.error('❌ Erreur:', error);
    } finally {
        setTimeout(async () => {
            await app.close();
            process.exit(0);
        }, 2000);
    }
}

bootstrap();
