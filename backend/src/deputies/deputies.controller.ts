import { Controller, Get, Param, Query, Res, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { DeputiesService } from './deputies.service';

@Controller('deputies')
export class DeputiesController {
    constructor(private readonly deputiesService: DeputiesService) {}

    @Get()
    async searchDeputies(
        @Query('q') query: string,
        @Query('sortBy') sortBy: string,
        @Query('limit') limit: string,
        @Query('offset') offset: string,
        @Query('userId') userId?: string,
    ) {
        const parsedLimit = limit ? parseInt(limit, 10) : 20;
        const parsedOffset = offset ? parseInt(offset, 10) : 0;
        const sort = sortBy || 'name_asc';
        return this.deputiesService.searchDeputies(query, sort, parsedLimit, parsedOffset, userId);
    }

    @Get('photo/:idAn')
    async getDeputyPhoto(@Param('idAn') idAn: string, @Res() res: Response) {
        try {
            const cleanId = idAn.replace('.jpg', '').replace(/^PA/i, '');
            const photoUrl = `https://www2.assemblee-nationale.fr/static/tribun/17/photos/${cleanId}.jpg`;
            
            const fetchResponse = await fetch(photoUrl);
            if (!fetchResponse.ok) {
                return res.status(404).send('Photo not found');
            }
            
            res.setHeader('Content-Type', 'image/jpeg');
            res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache navigateur de 24h
            res.setHeader('Access-Control-Allow-Origin', '*'); // Bypass CORS
            
            const buffer = await fetchResponse.arrayBuffer();
            res.send(Buffer.from(buffer));
        } catch (e) {
            res.status(500).send('Error fetching photo');
        }
    }

    @Get(':id')
    async getDeputyById(@Param('id') id: string) {
        return this.deputiesService.getDeputyById(id);
    }

    @Get(':id/votes')
    async getDeputyVotes(
        @Param('id') id: string,
        @Query('limit') limit: string,
    ) {
        const parsedLimit = limit ? parseInt(limit, 10) : 5;
        const votes = await this.deputiesService.getDeputyVotes(id, parsedLimit);
        return { votes };
    }

    @Get(':id/stats')
    async getDeputyStats(@Param('id') id: string) {
        const stats = await this.deputiesService.getDeputyStats(id);
        if (!stats) throw new NotFoundException('Stats not found for this deputy');
        return stats;
    }
}
