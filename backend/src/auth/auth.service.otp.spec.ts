import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { hashOtp, OTP_MAX_ATTEMPTS, OTP_TTL_MS } from './otp.util';
import { User } from '../users/user.entity';

describe('AuthService — OTP', () => {
    let users: Map<string, User>;
    let userRepository: any;
    let citizenRepository: any;
    let mailService: any;
    let service: AuthService;
    let refreshTokenService: any;

    const makeUser = (overrides: Partial<User> = {}): User => {
        const user = Object.assign(new User(), {
            id: 'user-1',
            emailVerified: false,
            emailEncrypted: 'enc',
            otpCode: hashOtp('user-1', '123456'),
            otpExpires: new Date(Date.now() + 60_000),
            otpAttempts: 0,
            ...overrides,
        });
        users.set(user.id, user);
        return user;
    };

    beforeAll(() => {
        process.env.OTP_SECRET = 'test-otp-secret';
    });

    beforeEach(() => {
        users = new Map();
        userRepository = {
            findOne: jest.fn(async ({ where }) => users.get(where.id) ?? null),
            save: jest.fn(async (u: User) => {
                users.set(u.id, u);
                return u;
            }),
        };
        citizenRepository = { findOne: jest.fn().mockResolvedValue({ id: 'cit-1', pseudo: 'jo' }) };
        mailService = { sendOtpEmail: jest.fn().mockResolvedValue(undefined) };
        const jwtService = { sign: jest.fn().mockReturnValue('jwt') };
        refreshTokenService = { issue: jest.fn().mockResolvedValue({ token: 'refresh-token' }) };
        service = new AuthService(userRepository, citizenRepository, {} as any, {} as any, mailService, jwtService as any, refreshTokenService);
        jest.spyOn(service as any, 'decryptEmail').mockReturnValue('jo@example.org');
    });

    it('verifies the right code and clears the OTP state', async () => {
        makeUser();
        const result = await service.verifyOtp('user-1', '123456');

        expect(result.success).toBe(true);
        expect(result).toMatchObject({ accessToken: 'jwt', refreshToken: 'refresh-token' });
        const saved = users.get('user-1');
        expect(saved.emailVerified).toBe(true);
        expect(saved.otpCode).toBeNull();
        expect(saved.otpAttempts).toBe(0);
    });

    it('rejects an expired code', async () => {
        makeUser({ otpExpires: new Date(Date.now() - 1) });
        await expect(service.verifyOtp('user-1', '123456')).rejects.toThrow(/expiré/);
    });

    it('counts wrong attempts and reports the remaining ones', async () => {
        makeUser();
        await expect(service.verifyOtp('user-1', '000000')).rejects.toThrow(`${OTP_MAX_ATTEMPTS - 1} tentative`);
        expect(users.get('user-1').otpAttempts).toBe(1);
    });

    it(`invalidates the code after ${OTP_MAX_ATTEMPTS} wrong attempts, even if the right one comes next`, async () => {
        makeUser();
        for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) {
            await expect(service.verifyOtp('user-1', '000000')).rejects.toBeInstanceOf(BadRequestException);
        }
        expect(users.get('user-1').otpCode).toBeNull();
        await expect(service.verifyOtp('user-1', '123456')).rejects.toBeInstanceOf(BadRequestException);
        expect(users.get('user-1').emailVerified).toBe(false);
    });

    it('resend issues a fresh hashed code, resets attempts and uses a 10-minute TTL', async () => {
        makeUser({ otpAttempts: 4 });
        const before = Date.now();

        await service.resendOtp('user-1');

        const saved = users.get('user-1');
        const sentCode: string = mailService.sendOtpEmail.mock.calls[0][1];
        expect(sentCode).toMatch(/^\d{6}$/);
        expect(saved.otpCode).toBe(hashOtp('user-1', sentCode));
        expect(saved.otpAttempts).toBe(0);
        expect(saved.otpExpires.getTime()).toBeGreaterThanOrEqual(before + OTP_TTL_MS);
        expect(saved.otpExpires.getTime()).toBeLessThanOrEqual(Date.now() + OTP_TTL_MS);
    });
});
