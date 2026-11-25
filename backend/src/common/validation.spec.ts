import { ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { createValidationPipe } from './validation';
import { OnboardingDto } from '../auth/dto/onboarding.dto';
import { LoginDto } from '../auth/dto/login.dto';
import { ResetPasswordDto } from '../auth/dto/reset-password.dto';
import { VerifyOtpDto, ResendOtpDto } from '../auth/dto/otp.dto';
import { VoteDto } from '../votes/dto/vote.dto';
import { CreateReportDto } from '../reports/dto/create-report.dto';
import { UpdateProfileDto } from '../users/dto/update-profile.dto';

const pipe = createValidationPipe();
const UUID = '3f2b8c1e-9a4d-4c3b-8e2f-1a2b3c4d5e6f';

const validate = (metatype: any, value: unknown) =>
    pipe.transform(value, { type: 'body', metatype } as ArgumentMetadata);

const errorMessage = async (metatype: any, value: unknown): Promise<string> => {
    try {
        await validate(metatype, value);
    } catch (e) {
        expect(e).toBeInstanceOf(BadRequestException);
        return (e as BadRequestException).getResponse()['message'];
    }
    throw new Error('expected a validation error');
};

const validOnboarding = {
    pseudo: 'citoyen42',
    birthYear: 1990,
    postalCode: '97400',
    email: 'jo@example.org',
    password: 'motdepasse',
};

describe('global ValidationPipe', () => {
    it('returns a single string message (the Flutter client reads message as a String)', async () => {
        const message = await errorMessage(OnboardingDto, { ...validOnboarding, email: 'nope', password: 'x' });
        expect(typeof message).toBe('string');
        expect(message).toContain("L'adresse email est invalide");
        expect(message).toContain('au moins 8 caractères');
    });

    it('strips properties that are not declared in the DTO', async () => {
        const result = await validate(OnboardingDto, { ...validOnboarding, isAdmin: true, xp: 99999 });
        expect(result).not.toHaveProperty('isAdmin');
        expect(result).not.toHaveProperty('xp');
        expect(result).toBeInstanceOf(OnboardingDto);
    });
});

describe('OnboardingDto', () => {
    it('accepts a valid registration', async () => {
        await expect(validate(OnboardingDto, validOnboarding)).resolves.toBeTruthy();
    });

    it.each([
        ['pseudo with a space', { pseudo: 'jean dupont' }, 'pseudo'],
        ['pseudo too long', { pseudo: 'a'.repeat(21) }, 'pseudo'],
        ['birth year as string', { birthYear: '1990' }, 'année'],
        ['birth year in the future', { birthYear: new Date().getFullYear() + 1 }, 'année'],
        ['invalid department', { postalCode: '96000' }, 'code postal'],
        ['postal code with letters', { postalCode: '75OO1' }, 'code postal'],
        ['short password', { password: 'abc' }, 'mot de passe'],
        ['password beyond bcrypt limit', { password: 'a'.repeat(73) }, 'mot de passe'],
    ])('rejects %s', async (_label, override, expected) => {
        const message = await errorMessage(OnboardingDto, { ...validOnboarding, ...override });
        expect(message.toLowerCase()).toContain(expected);
    });
});

describe('LoginDto', () => {
    it('accepts short legacy passwords and email logins', async () => {
        await expect(validate(LoginDto, { pseudo: 'jo@example.org', password: 'abc' })).resolves.toBeTruthy();
    });

    it('rejects empty credentials', async () => {
        await expect(validate(LoginDto, { pseudo: '', password: '' })).rejects.toBeInstanceOf(BadRequestException);
        await expect(validate(LoginDto, {})).rejects.toBeInstanceOf(BadRequestException);
    });
});

describe('ResetPasswordDto', () => {
    it('enforces the new minimum length', async () => {
        await expect(validate(ResetPasswordDto, { token: 't', newPassword: 'short' })).rejects.toBeInstanceOf(BadRequestException);
        await expect(validate(ResetPasswordDto, { token: 't', newPassword: 'longenough' })).resolves.toBeTruthy();
    });
});

describe('OTP DTOs', () => {
    it('accepts a uuid and a 6-digit code (surrounding spaces allowed)', async () => {
        await expect(validate(VerifyOtpDto, { userId: UUID, code: ' 012345 ' })).resolves.toBeTruthy();
        await expect(validate(ResendOtpDto, { userId: UUID })).resolves.toBeTruthy();
    });

    it('rejects malformed ids and codes', async () => {
        await expect(validate(VerifyOtpDto, { userId: 'not-a-uuid', code: '012345' })).rejects.toBeInstanceOf(BadRequestException);
        await expect(validate(VerifyOtpDto, { userId: UUID, code: '12345' })).rejects.toBeInstanceOf(BadRequestException);
        await expect(validate(VerifyOtpDto, { userId: UUID, code: 'abcdef' })).rejects.toBeInstanceOf(BadRequestException);
        await expect(validate(ResendOtpDto, {})).rejects.toBeInstanceOf(BadRequestException);
    });
});

describe('VoteDto', () => {
    it.each(['FOR', 'AGAINST', 'ABSTAIN'])('accepts %s', async (choice) => {
        await expect(validate(VoteDto, { lawId: UUID, choice })).resolves.toBeTruthy();
    });

    it('rejects unknown choices and non-uuid law ids', async () => {
        await expect(validate(VoteDto, { lawId: UUID, choice: 'MAYBE' })).rejects.toBeInstanceOf(BadRequestException);
        await expect(validate(VoteDto, { lawId: "1' OR '1'='1", choice: 'FOR' })).rejects.toBeInstanceOf(BadRequestException);
    });
});

describe('CreateReportDto', () => {
    it('accepts a valid report', async () => {
        await expect(validate(CreateReportDto, { lawId: UUID, category: 'SUMMARY', description: 'Erreur' })).resolves.toBeTruthy();
    });

    it('rejects unknown categories and oversized descriptions', async () => {
        await expect(validate(CreateReportDto, { lawId: UUID, category: 'SPAM' })).rejects.toBeInstanceOf(BadRequestException);
        await expect(
            validate(CreateReportDto, { lawId: UUID, category: 'OTHER', description: 'x'.repeat(2001) }),
        ).rejects.toBeInstanceOf(BadRequestException);
    });
});

describe('UpdateProfileDto', () => {
    it('accepts partial updates', async () => {
        await expect(validate(UpdateProfileDto, { notifyLawResults: false })).resolves.toBeTruthy();
        await expect(validate(UpdateProfileDto, { constituencyCode: '75-01' })).resolves.toBeTruthy();
    });

    it('rejects non-boolean flags and invalid emails', async () => {
        await expect(validate(UpdateProfileDto, { notifyLawResults: 'yes' })).rejects.toBeInstanceOf(BadRequestException);
        await expect(validate(UpdateProfileDto, { email: 'nope' })).rejects.toBeInstanceOf(BadRequestException);
    });
});
