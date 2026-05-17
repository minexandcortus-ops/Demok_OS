import { NestFactory } from '@nestjs/core';
import { SurveysModule } from './surveys/surveys.module';
import { SurveysService } from './surveys/surveys.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PresidentialVote } from './surveys/presidential-vote.entity';
import { SurveyRegistry } from './surveys/survey-registry.entity';
import { SurveyUrna } from './surveys/survey-urna.entity';
import { Citizen } from './users/citizen.entity';
import { Repository } from 'typeorm';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const presidentialVoteRepo = app.get<Repository<PresidentialVote>>(getRepositoryToken(PresidentialVote));
    const registryRepo = app.get<Repository<SurveyRegistry>>(getRepositoryToken(SurveyRegistry));
    const urnaRepo = app.get<Repository<SurveyUrna>>(getRepositoryToken(SurveyUrna));
    const citizenRepo = app.get<Repository<Citizen>>(getRepositoryToken(Citizen));
    const surveysService = app.get(SurveysService);

    console.log('🚀 Démarrage de la migration des votes présidentiels...');

    const votes = await presidentialVoteRepo.find({ relations: ['user'] });
    console.log(`📊 ${votes.length} votes à migrer.`);

    let migrated = 0;
    let skipped = 0;

    for (const vote of votes) {
        try {
            const citizen = await citizenRepo.findOne({ where: { user: { id: vote.user.id } } });
            if (!citizen) {
                console.warn(`⚠️ Citoyen non trouvé pour l'user ${vote.user.id}, skip.`);
                skipped++;
                continue;
            }

            const surveyId = 'PRESIDENTIAL_2027';
            const voterToken = (surveysService as any).generateVoterToken(citizen.id, surveyId);

            // Create Registry
            const registry = new SurveyRegistry();
            registry.citizen = citizen;
            registry.surveyId = surveyId;
            registry.surveyType = 'PRESIDENTIAL';
            registry.createdAt = vote.createdAt;
            await registryRepo.save(registry);

            // Create Urna
            const urna = new SurveyUrna();
            urna.surveyId = surveyId;
            urna.voterToken = voterToken;
            urna.choiceId = (vote as any).candidateId || (vote.candidate ? vote.candidate.id : null);
            urna.createdAt = vote.createdAt;
            
            if (!urna.choiceId) {
                // Re-fetch with relations if missing
                const fullVote = await presidentialVoteRepo.findOne({ where: { id: vote.id }, relations: ['candidate'] });
                urna.choiceId = fullVote.candidate.id;
            }
            
            await urnaRepo.save(urna);
            migrated++;
        } catch (e) {
            console.error(`❌ Erreur lors de la migration du vote ${vote.id}:`, e.message);
            skipped++;
        }
    }

    console.log(`✅ Migration terminée : ${migrated} migrés, ${skipped} ignorés.`);
    await app.close();
}

bootstrap();
