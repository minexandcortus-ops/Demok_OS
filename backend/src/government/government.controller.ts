import { Controller, Get, Logger } from '@nestjs/common';
import { GovernmentService, GovernmentMember } from './government.service';

@Controller('government')
export class GovernmentController {
    private readonly logger = new Logger(GovernmentController.name);

    constructor(private readonly governmentService: GovernmentService) {}

    @Get('composition')
    async getComposition(): Promise<GovernmentMember[]> {
        this.logger.log('GET /government/composition hit');
        return this.governmentService.getGovernmentComposition();
    }
}
