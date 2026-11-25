import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import * as request from 'supertest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AUTH_THROTTLE_MESSAGE, AUTH_THROTTLER_OPTIONS, AUTH_THROTTLE_STRICT } from './auth.throttle';

describe('AuthController rate limiting', () => {
    let app: INestApplication;

    beforeEach(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [ThrottlerModule.forRoot(AUTH_THROTTLER_OPTIONS)],
            controllers: [AuthController],
            providers: [
                {
                    provide: AuthService,
                    useValue: {
                        verifyOtp: jest.fn().mockResolvedValue({ success: true }),
                        checkPseudoAvailability: jest.fn().mockResolvedValue({ available: true }),
                    },
                },
            ],
        }).compile();
        app = moduleRef.createNestApplication();
        await app.init();
    });

    afterEach(async () => {
        await app.close();
    });

    it(`blocks /auth/verify-otp after ${AUTH_THROTTLE_STRICT.limit} requests per minute`, async () => {
        for (let i = 0; i < AUTH_THROTTLE_STRICT.limit; i++) {
            await request(app.getHttpServer()).post('/auth/verify-otp').send({ userId: 'u', code: '000000' }).expect(201);
        }
        const res = await request(app.getHttpServer()).post('/auth/verify-otp').send({ userId: 'u', code: '000000' }).expect(429);
        expect(res.body.message).toBe(AUTH_THROTTLE_MESSAGE);
    });

    it('keeps the looser default limit on /auth/check-pseudo', async () => {
        for (let i = 0; i < AUTH_THROTTLE_STRICT.limit + 1; i++) {
            await request(app.getHttpServer()).get('/auth/check-pseudo?pseudo=jo').expect(200);
        }
    });
});
