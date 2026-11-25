import { GUARDS_METADATA } from '@nestjs/common/constants';
import { HealthController, PublicHealthController } from './health.controller';
import { AdminKeyGuard } from './admin-key.guard';

describe('PublicHealthController', () => {
    it('reports ok without exposing configuration when the database answers', async () => {
        const repo = { query: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };
        const controller = new PublicHealthController(repo as any);

        const result = await controller.getHealth();

        expect(result.status).toBe('ok');
        expect(Object.keys(result).sort()).toEqual(['status', 'timestamp']);
    });

    it('reports unhealthy without leaking the error message', async () => {
        const repo = { query: jest.fn().mockRejectedValue(new Error('password authentication failed for user x')) };
        const controller = new PublicHealthController(repo as any);

        const result = await controller.getHealth();

        expect(result.status).toBe('unhealthy');
        expect(JSON.stringify(result)).not.toContain('password');
    });

    it('is not guarded', () => {
        expect(Reflect.getMetadata(GUARDS_METADATA, PublicHealthController) ?? []).toEqual([]);
    });
});

describe('HealthController (detailed)', () => {
    it('is protected by the admin key', () => {
        expect(Reflect.getMetadata(GUARDS_METADATA, HealthController)).toContain(AdminKeyGuard);
    });
});
