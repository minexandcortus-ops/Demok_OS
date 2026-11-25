import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import * as request from 'supertest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AUTH_THROTTLER_OPTIONS } from './auth.throttle';

describe('AuthService — refresh, logout and password reset', () => {
    const user = { id: 'user-1' } as any;
    let refreshTokenService: any;
    let service: AuthService;

    beforeEach(() => {
        refreshTokenService = {
            issue: jest.fn().mockResolvedValue({ token: 'new-refresh' }),
            rotate: jest.fn().mockResolvedValue({ user, token: 'rotated-refresh' }),
            revoke: jest.fn(),
            revokeAllForUser: jest.fn(),
        };
        const userRepository = {
            findOne: jest.fn().mockResolvedValue({ id: 'user-1', resetToken: 't', resetTokenExpires: new Date(Date.now() + 60_000) }),
            save: jest.fn(),
        };
        const jwtService = { sign: jest.fn().mockReturnValue('access-jwt') };
        service = new AuthService(userRepository as any, {} as any, {} as any, {} as any, {} as any, jwtService as any, refreshTokenService);
    });

    it('refresh returns a new access token and the rotated refresh token', async () => {
        await expect(service.refresh('old')).resolves.toEqual({ accessToken: 'access-jwt', refreshToken: 'rotated-refresh' });
        expect(refreshTokenService.rotate).toHaveBeenCalledWith('old');
    });

    it('logout revokes the refresh token', async () => {
        await service.logout('tok');
        expect(refreshTokenService.revoke).toHaveBeenCalledWith('tok');
    });

    it('a password reset closes every session', async () => {
        await service.resetPassword('t', 'nouveau-mot-de-passe');
        expect(refreshTokenService.revokeAllForUser).toHaveBeenCalledWith('user-1');
    });
});

describe('AuthController — refresh endpoints', () => {
    let app: INestApplication;
    const authService = { refresh: jest.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'r' }), logout: jest.fn().mockResolvedValue({ success: true }) };

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [ThrottlerModule.forRoot(AUTH_THROTTLER_OPTIONS)],
            controllers: [AuthController],
            providers: [{ provide: AuthService, useValue: authService }],
        }).compile();
        app = moduleRef.createNestApplication();
        await app.init();
    });

    afterAll(() => app.close());

    const valid = 'x'.repeat(64);

    it('POST /auth/refresh answers 200 with the new pair', async () => {
        const res = await request(app.getHttpServer()).post('/auth/refresh').send({ refreshToken: valid }).expect(200);
        expect(res.body).toEqual({ accessToken: 'a', refreshToken: 'r' });
    });

    it('rejects malformed refresh tokens', async () => {
        await request(app.getHttpServer()).post('/auth/refresh').send({ refreshToken: 'short' }).expect(400);
        await request(app.getHttpServer()).post('/auth/refresh').send({}).expect(400);
    });

    it('POST /auth/logout answers 200', async () => {
        await request(app.getHttpServer()).post('/auth/logout').send({ refreshToken: valid }).expect(200);
        expect(authService.logout).toHaveBeenCalledWith(valid);
    });
});
