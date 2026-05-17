import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report, ReportCategory, ReportStatus } from './entities/report.entity';

@Injectable()
export class ReportsService {
    private readonly logger = new Logger(ReportsService.name);

    constructor(
        @InjectRepository(Report)
        private readonly reportRepository: Repository<Report>,
    ) {}

    async createReport(lawId: string, userId: string | undefined, category: ReportCategory, description: string): Promise<Report> {
        this.logger.log(`New report creation for lawId: ${lawId}, category: ${category}`);
        
        const report = this.reportRepository.create({
            lawId,
            userId,
            category,
            description,
        });

        const savedReport = await this.reportRepository.save(report);
        this.logger.log(`Report created with ID: ${savedReport.id}`);
        
        return savedReport;
    }

    async findAll(status?: ReportStatus): Promise<Report[]> {
        const where = status ? { status } : {};
        return this.reportRepository.find({
            where,
            order: { createdAt: 'DESC' },
        });
    }

    async updateStatus(id: string, status: ReportStatus): Promise<Report> {
        await this.reportRepository.update(id, { status });
        return this.reportRepository.findOne({ where: { id } });
    }
}

