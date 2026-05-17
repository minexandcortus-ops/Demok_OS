import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { IngestionANService } from '../ingestion/ingestion-an.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Law, LawStatus } from '../laws/law.entity';
import { Repository, IsNull, Raw, In } from 'typeorm';
import { Logger } from '@nestjs/common';

async function bootstrap() {
    const logger = new Logger('ReSyncDossiers');
    const app = await NestFactory.createApplicationContext(AppModule);
    const ingestionService = app.get(IngestionANService);
    const lawRepository = app.get<Repository<Law>>(getRepositoryToken(Law));

    logger.log('🚀 Démarrage de la re-synchronisation des document_numbers...');
    logger.log('⚠️  Ce script ne modifie QUE document_numbers, jamais le statut des lois.');

    // Récupérer les lois sans document_numbers (indépendamment du statut)
    const laws = await lawRepository.find({
        where: [
            { documentNumbers: IsNull() },
            { documentNumbers: Raw(alias => `${alias} = '[]'::jsonb`) }
        ]
    });

    logger.log(`🔍 ${laws.length} lois sans document_numbers trouvées.`);

    const dossierIds = laws.map(l => l.externalId);
    
    // Batch processing (par 50)
    const batchSize = 50;
    for (let i = 0; i < dossierIds.length; i += batchSize) {
        const batch = dossierIds.slice(i, i + batchSize);
        logger.log(`📦 Traitement du batch ${Math.floor(i / batchSize) + 1} / ${Math.ceil(dossierIds.length / batchSize)}...`);
        
        const processedLaws = await ingestionService.importSpecificLaws(batch);
        
        for (const processed of processedLaws) {
            const pid = (processed.externalId || '').trim();
            const existing = laws.find(l => l.externalId.trim().toUpperCase() === pid.toUpperCase());
            if (existing) {
                const docNums = processed.documentNumbers ?? [];
                // ✅ On ne met à jour QUE les document_numbers - JAMAIS le statut
                await lawRepository.query(
                    `UPDATE law SET "document_numbers" = $1::jsonb WHERE "externalId" = $2`,
                    [JSON.stringify(docNums), existing.externalId]
                );
                logger.log(`✅ ${processed.externalId} → document_numbers: [${docNums.join(', ')}]`);
            }
        }
    }

    logger.log('✅ Re-synchronisation terminée (statuts inchangés).');
    await app.close();
}

bootstrap();
