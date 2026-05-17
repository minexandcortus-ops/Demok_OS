import { Controller, Get, Delete, Param, Query, UseGuards } from '@nestjs/common';
import { DebatesService } from '../debates/debates.service';
import { AdminKeyGuard } from './admin-key.guard';

@UseGuards(AdminKeyGuard)
@Controller('admin/debates')
export class AdminDebatesController {
    constructor(private readonly debatesService: DebatesService) {}

    /**
     * GET /admin/debates
     * Liste tous les avis pour modération
     */
    @Get()
    async getOpinions(
        @Query('q') q?: string,
        @Query('reportedOnly') reportedOnly?: string,
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
    ) {
        const take = limit ? parseInt(limit, 10) : 50;
        const skip = offset ? parseInt(offset, 10) : 0;
        const onlyReported = reportedOnly === 'true';

        const [opinions, total] = await this.debatesService.findAllForAdmin(q, take, skip, onlyReported);

        return {
            total,
            opinions: opinions.map(op => ({
                id: op.id,
                content: op.content,
                mokes: op.mokes,
                createdAt: op.createdAt,
                userId: op.userId,
                userPseudo: (op.user as any)?.pseudo || 'Citoyen masqué',
                lawId: op.lawId,
                lawTitle: op.law?.titleVulgarized || op.law?.titleOfficial || 'Loi inconnue',
                reportsCount: op.reportsList?.length || 0,
            })),
        };
    }

    /**
     * DELETE /admin/debates/:id
     * Supprime un avis
     */
    @Delete(':id')
    async deleteOpinion(
        @Param('id') id: string,
    ) {
        await this.debatesService.deleteOpinion(id);
        return { success: true, message: 'Avis supprimé' };
    }
}
