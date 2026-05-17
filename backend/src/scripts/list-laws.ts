import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Law, LawStatus } from '../laws/law.entity';
import { Repository } from 'typeorm';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const lawRepo = app.get<Repository<Law>>(getRepositoryToken(Law));
    
    const pendingLaws = await lawRepo.find({
        where: { status: LawStatus.PENDING },
        order: { agendaDate: 'DESC' }
    });
    
    console.log(`Found ${pendingLaws.length} PENDING laws:`);
    pendingLaws.forEach(l => {
        console.log(`- [${l.externalId}] ${l.agendaDate} | ${l.titleOfficial.substring(0, 100)}...`);
    });
    
    await app.close();
}

bootstrap();
