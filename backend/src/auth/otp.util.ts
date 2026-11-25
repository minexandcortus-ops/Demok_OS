import { createHmac, randomInt, timingSafeEqual } from 'crypto';

export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const OTP_MAX_ATTEMPTS = 5;

/** Génère un code OTP numérique à 6 chiffres avec un CSPRNG. */
export function generateOtp(): string {
    return randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, '0');
}

function otpSecret(): string {
    const secret = process.env.OTP_SECRET || process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('OTP_SECRET (ou JWT_SECRET) doit être défini');
    }
    return secret;
}

/**
 * Hache un OTP lié à un utilisateur (HMAC-SHA256 avec un secret serveur).
 * Un dump de la base ne suffit donc pas à retrouver les codes en cours.
 */
export function hashOtp(userId: string, code: string): string {
    return createHmac('sha256', otpSecret()).update(`${userId}:${code}`).digest('hex');
}

/** Compare un code saisi au hash stocké, en temps constant. */
export function verifyOtpHash(userId: string, code: string, storedHash: string): boolean {
    if (!storedHash || typeof code !== 'string') return false;
    const candidate = Buffer.from(hashOtp(userId, code.trim()), 'hex');
    const expected = Buffer.from(storedHash, 'hex');
    if (candidate.length !== expected.length) return false;
    return timingSafeEqual(candidate, expected);
}
