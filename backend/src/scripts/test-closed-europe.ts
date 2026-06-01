import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { NotificationProcessor } from '../notifications/notification.processor';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { TopicPoll } from '../surveys/topic-poll.entity';
import { SurveyRegistry } from '../surveys/survey-registry.entity';

async function bootstrap() {
    console.log('🚀 Simulation: Clôture du sondage "Réarmement Europe"...');
    
    const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
    
    try {
        console.log('⏳ Recherche du sondage dans la base de données...');
        const pollRepo = app.get<Repository<TopicPoll>>(getRepositoryToken(TopicPoll));
        const registryRepo = app.get<Repository<SurveyRegistry>>(getRepositoryToken(SurveyRegistry));
        const processor = app.get(NotificationProcessor);

        // Trouver le sondage
        const poll = await pollRepo.findOne({ where: { question: Like('%Europe%') } });
        if (!poll) {
            console.error('❌ Sondage sur l\'Europe non trouvé en base de données.');
            process.exit(1);
        }

        console.log(`✅ Sondage trouvé : "${poll.question}" (ID: ${poll.id})`);
        
        // Trouver les votants (Nouveau système via Registry)
        const registries = await registryRepo.find({ 
            where: { surveyId: poll.id },
            relations: ['citizen', 'citizen.user']
        });
        
        // On a besoin des IDs User (et non des IDs Citizen) pour les notifications
        const voterIds = registries
            .map(r => r.citizen?.user?.id)
            .filter(id => id !== undefined && id !== null);

        console.log(`👥 Nombre de participants trouvés pour ce sondage : ${voterIds.length}`);

        if (voterIds.length === 0) {
            console.warn('⚠️ Personne n\'a voté sur ce sondage, aucune notification ne sera envoyée.');
        } else {
            console.log('📬 Envoi de la notification de clôture aux participants...');
            // Simuler l'action "survey-closed" du job
            await processor.handleSurveyClosed({
                data: {
                    pollId: poll.id,
                    question: poll.question,
                    voterIds: voterIds
                }
            } as any);

            console.log('✅ Notification de clôture envoyée !');
            console.log('📱 Vérifiez votre téléphone si vous aviez voté à CE sondage !');
        }

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
