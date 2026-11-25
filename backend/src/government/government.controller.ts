import { Controller, Get, Logger } from '@nestjs/common';
import { GovernmentService, GovernmentMember } from './government.service';
import { PublicCache } from '../common/http-cache';

@Controller('government')
export class GovernmentController {
    private readonly logger = new Logger(GovernmentController.name);

    constructor(private readonly governmentService: GovernmentService) {}

    @Get('composition')
    @PublicCache(3600)
    async getComposition(): Promise<GovernmentMember[]> {
        this.logger.log('GET /government/composition hit');
        return this.governmentService.getGovernmentComposition();
    }
}
