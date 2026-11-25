import { UnauthorizedException } from '@nestjs/common';
import { hashRefreshToken, RefreshTokenService } from './refresh-token.service';
import { User } from '../users/user.entity';

describe('RefreshTokenService', () => {
    let rows: any[];
    let repository: any;
    let service: RefreshTokenService;
    const user = Object.assign(new User(), { id: 'user-1' });

    beforeEach(() => {
        rows = [];
        let seq = 0;
        repository = {
            create: jest.fn((x) => ({ ...x })),
            save: jest.fn(async (x) => {
                if (!x.id) {
                    x.id = `rt-${++seq}`;
                    rows.push(x);
                }
                return x;
            }),
            findOne: jest.fn(async ({ where }) => rows.find((r) => r.tokenHash === where.tokenHash) ?? null),
            update: jest.fn(async (criteria: any, patch: any) => {
                for (const r of rows) {
                    const matchUser = criteria.user ? r.user.id === criteria.user.id : true;
                    const matchHash = criteria.tokenHash ? r.tokenHash === criteria.tokenHash : true;
                    if (matchUser && matchHash && !r.revokedAt) Object.assign(r, patch);
                }
            }),
        };
        service = new RefreshTokenService(repository);
    });

    it('issues an opaque token and stores only its SHA-256', async () => {
        const { token } = await service.issue(user);
        expect(token.length).toBeGreaterThanOrEqual(60);
        expect(rows[0].tokenHash).toBe(hashRefreshToken(token));
        expect(JSON.stringify(rows[0])).not.toContain(token);
        expect(rows[0].expiresAt.getTime()).toBeGreaterThan(Date.now() + 59 * 86_400_000);
    });

    it('rotates: the old token is revoked and points to its replacement', async () => {
        const { token } = await service.issue(user);
        const rotated = await service.rotate(token);

        expect(rotated.user).toBe(user);
        expect(rotated.token).not.toBe(token);
        expect(rows[0].revokedAt).toBeInstanceOf(Date);
        expect(rows[0].replacedById).toBe(rows[1].id);
        await expect(service.rotate(rotated.token)).resolves.toBeTruthy();
    });

    it('detects reuse of a rotated token and revokes every session of the user', async () => {
        const { token } = await service.issue(user);
        const { token: second } = await service.rotate(token);

        await expect(service.rotate(token)).rejects.toBeInstanceOf(UnauthorizedException);
        // la session légitime est aussi fermée : l'attaquant ne peut pas la poursuivre
        await expect(service.rotate(second)).rejects.toBeInstanceOf(UnauthorizedException);
        expect(rows.every((r) => r.revokedAt)).toBe(true);
    });

    it('refuses unknown, expired and logged-out tokens', async () => {
        await expect(service.rotate('nope')).rejects.toBeInstanceOf(UnauthorizedException);

        const { token } = await service.issue(user);
        rows[0].expiresAt = new Date(Date.now() - 1);
        await expect(service.rotate(token)).rejects.toBeInstanceOf(UnauthorizedException);

        const { token: other } = await service.issue(user);
        await service.revoke(other);
        await expect(service.rotate(other)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('honours REFRESH_TOKEN_TTL_DAYS', async () => {
        process.env.REFRESH_TOKEN_TTL_DAYS = '7';
        await service.issue(user);
        delete process.env.REFRESH_TOKEN_TTL_DAYS;
        expect(rows[0].expiresAt.getTime()).toBeLessThan(Date.now() + 8 * 86_400_000);
    });
});
