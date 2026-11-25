import { generateOtp, hashOtp, verifyOtpHash, OTP_LENGTH } from './otp.util';

describe('otp.util', () => {
    const originalSecret = process.env.OTP_SECRET;
    beforeAll(() => {
        process.env.OTP_SECRET = 'test-otp-secret';
    });
    afterAll(() => {
        process.env.OTP_SECRET = originalSecret;
    });

    it('generates 6-digit numeric codes, zero padded', () => {
        for (let i = 0; i < 500; i++) {
            const code = generateOtp();
            expect(code).toMatch(new RegExp(`^\\d{${OTP_LENGTH}}$`));
        }
    });

    it('produces varied codes (CSPRNG, not a constant)', () => {
        const codes = new Set(Array.from({ length: 200 }, () => generateOtp()));
        expect(codes.size).toBeGreaterThan(190);
    });

    it('never stores the code in clear', () => {
        const hash = hashOtp('user-1', '123456');
        expect(hash).toMatch(/^[0-9a-f]{64}$/);
        expect(hash).not.toContain('123456');
    });

    it('binds the hash to the user id', () => {
        expect(hashOtp('user-1', '123456')).not.toEqual(hashOtp('user-2', '123456'));
    });

    it('verifies the right code (trimmed) and rejects others', () => {
        const stored = hashOtp('user-1', '042424');
        expect(verifyOtpHash('user-1', ' 042424 ', stored)).toBe(true);
        expect(verifyOtpHash('user-1', '042425', stored)).toBe(false);
        expect(verifyOtpHash('user-2', '042424', stored)).toBe(false);
    });

    it('rejects legacy clear-text or empty stored values', () => {
        expect(verifyOtpHash('user-1', '123456', '123456')).toBe(false);
        expect(verifyOtpHash('user-1', '123456', '')).toBe(false);
        expect(verifyOtpHash('user-1', '123456', null as any)).toBe(false);
    });

    it('fails loudly when no secret is configured', () => {
        const otp = process.env.OTP_SECRET;
        const jwt = process.env.JWT_SECRET;
        delete process.env.OTP_SECRET;
        delete process.env.JWT_SECRET;
        expect(() => hashOtp('u', '000000')).toThrow();
        process.env.OTP_SECRET = otp;
        process.env.JWT_SECRET = jwt;
    });
});
