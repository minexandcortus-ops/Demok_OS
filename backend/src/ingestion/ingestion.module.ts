import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { IngestionANService } from './ingestion-an.service';
import { IngestionHtmlAgendaService } from './ingestion-html-agenda.service';
import { NormalizerService } from './normalizer.service';
import { DiffDetectorService } from './diff-detector.service';
import { SummaryUpdaterService } from './summary-updater.service';
import { DeputyVoteIngestionService } from './deputy-vote-ingestion.service';
import { AmendementIngestionService } from './amendement-ingestion.service';
import { DocumentIngestionService } from './document-ingestion.service';
import { CompteRenduScrapingService } from './compte-rendu-scraping.service';
import { LawScraperService } from './law-scraper.service';
import { Law } from '../laws/law.entity';
import { Amendement } from '../laws/amendement.entity';
import { Constituency } from '../users/constituency.entity';
import { Category } from '../laws/category.entity';
import { Candidate } from '../surveys/candidate.entity';
import { Deputy } from '../votes/deputy.entity';
import { OfficialVote } from '../votes/official-vote.entity';
import { CategoriesModule } from '../laws/categories.module';

@Module({
    imports: [
        HttpModule,
        TypeOrmModule.forFeature([Law, Amendement, Constituency, Category, Candidate, Deputy, OfficialVote]),
        CategoriesModule,
    ],
    providers: [
        IngestionANService,
        IngestionHtmlAgendaService,
        NormalizerService,
        DiffDetectorService,
        SummaryUpdaterService,
        DeputyVoteIngestionService,
        AmendementIngestionService,
        DocumentIngestionService,
        CompteRenduScrapingService,
        LawScraperService,
    ],
    exports: [
        IngestionANService,
        IngestionHtmlAgendaService,
        SummaryUpdaterService,
        DeputyVoteIngestionService,
        AmendementIngestionService,
        DocumentIngestionService,
        CompteRenduScrapingService,
        LawScraperService,
    ],
})
export class IngestionModule { }
