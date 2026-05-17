import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportCategory } from './entities/report.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/get-user.decorator';
import { User } from '../users/user.entity';

export class CreateReportDto {
    lawId: string;
    category: ReportCategory;
    description: string;
}

@Controller('reports')
export class ReportsController {
    constructor(private readonly reportsService: ReportsService) {}

    @Post()
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.CREATED)
    async createReport(
        @CurrentUser() user: User,
        @Body() dto: CreateReportDto,
    ) {
        return this.reportsService.createReport(dto.lawId, user.id, dto.category, dto.description);
    }
}
