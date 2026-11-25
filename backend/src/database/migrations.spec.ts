import { AddOtpAttempts1795599623708 } from './migrations/1795599623708-AddOtpAttempts';

describe('AddOtpAttempts migration', () => {
    it('is idempotent on databases where synchronize already added the column', async () => {
        const queryRunner = { query: jest.fn() };
        await new AddOtpAttempts1795599623708().up(queryRunner as any);
        expect(queryRunner.query).toHaveBeenCalledWith(expect.stringContaining('ADD COLUMN IF NOT EXISTS "otpAttempts"'));
    });
});
