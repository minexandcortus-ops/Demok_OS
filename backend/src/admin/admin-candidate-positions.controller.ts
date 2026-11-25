import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, UseGuards, ValidationPipe } from '@nestjs/common';
import { AdminKeyGuard } from './admin-key.guard';
import { CandidatePositionsService } from '../surveys/candidate-positions.service';
import { CandidatePositionDto } from '../surveys/dto/candidate-position.dto';

const PIPE = new ValidationPipe({ whitelist: true, transform: true });

/** Saisie des positions déclarées (sourcées) des candidats. */
@UseGuards(AdminKeyGuard)
@Controller('admin/candidate-positions')
export class AdminCandidatePositionsController {
    constructor(private readonly service: CandidatePositionsService) { }

    @Get()
    async list(@Query('candidateId') candidateId?: string, @Query('lawId') lawId?: string) {
        return this.service.listDeclared({ candidateId, lawId });
    }

    @Post()
    async upsert(@Body(PIPE) dto: CandidatePositionDto) {
        return this.service.upsertDeclared(dto);
    }

    @Delete(':id')
    async remove(@Param('id', new ParseUUIDPipe()) id: string) {
        return this.service.deleteDeclared(id);
    }
}
