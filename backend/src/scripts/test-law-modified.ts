import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { NotificationProcessor } from '../notifications/notification.processor';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VoteRegistry } from '../votes/vote-registry.entity';
import { Law } from '../laws/law.entity';

async function bootstrap() {
    console.log('🚀 Simulation: Modification d\'une loi sur laquelle vous avez voté...');
    
    const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
    
    try {
        console.log('⏳ Recherche d\'un vote existant dans la base de données...');
        const voteRepo = app.get<Repository<VoteRegistry>>(getRepositoryToken(VoteRegistry));
        const processor = app.get(NotificationProcessor);

        // Trouver un vote quelconque pour prendre sa loi (et l'utilisateur)
        const vote = await voteRepo.findOne({ 
            relations: ['citizen', 'citizen.user', 'law'],
            order: { votedAt: 'DESC' }
        });

        if (!vote || !vote.law || !vote.citizen?.user) {
            console.error('❌ Aucun vote trouvé en base de données, impossible de simuler.');
            process.exit(1);
        }

        const lawId = vote.law.id;
        const lawTitle = vote.law.titleOfficial || 'Loi sans titre';
        const userId = vote.citizen.user.id;

        console.log(`✅ Loi trouvée : "${lawTitle}"`);
        console.log(`📬 Envoi de la notification de modification à l'utilisateur...`);

        // Simuler l'action "law-modified" du job Redis
        await processor.handleLawModified({
            data: {
                userId: userId,
                lawId: lawId,
                lawTitle: lawTitle,
                message: `La loi "${lawTitle}" sur laquelle vous avez voté a été modifiée.`,
            }
        } as any);

        console.log('✅ Notification de loi modifiée envoyée !');
        console.log('📱 Vérifiez votre téléphone !');

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
