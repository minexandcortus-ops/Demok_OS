import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Candidate } from '../surveys/candidate.entity';
import { AdminKeyGuard } from './admin-key.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';

// Ensure upload directory exists
const uploadDir = './uploads/candidates';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + extname(file.originalname));
    }
});

@UseGuards(AdminKeyGuard)
@Controller('admin/candidates')
export class AdminCandidatesController {
    constructor(
        @InjectRepository(Candidate)
        private readonly candidateRepository: Repository<Candidate>,
    ) {}

    @Get()
    async findAll() {
        const candidates = await this.candidateRepository.find();
        return candidates.sort((a, b) => {
            const getLastName = (name: string) => name.split(' ').slice(1).join(' ') || name;
            const lastNameA = getLastName(a.name).toLowerCase();
            const lastNameB = getLastName(b.name).toLowerCase();
            return lastNameA.localeCompare(lastNameB, 'fr');
        });
    }

    @Post()
    async create(@Body() body: any) {
        // Find max displayOrder if order matters, though user said alphabetical
        // We'll just set it to 0
        const candidate = this.candidateRepository.create({ ...body, displayOrder: 0 });
        return this.candidateRepository.save(candidate);
    }

    @Put(':id')
    async update(@Param('id') id: string, @Body() body: any) {
        await this.candidateRepository.update(id, body);
        return this.candidateRepository.findOneBy({ id });
    }

    @Delete(':id')
    async remove(@Param('id') id: string) {
        await this.candidateRepository.delete(id);
        return { success: true };
    }

    @Post('upload')
    @UseInterceptors(FileInterceptor('file', { storage }))
    uploadFile(@UploadedFile() file: Express.Multer.File) {
        if (!file) {
            throw new BadRequestException('No file uploaded');
        }
        return {
            url: `/api/uploads/candidates/${file.filename}`
        };
    }
}
