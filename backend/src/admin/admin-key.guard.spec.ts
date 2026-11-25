import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AdminKeyGuard, safeSecretEquals } from './admin-key.guard';

const contextWithHeaders = (headers: Record<string, unknown>): ExecutionContext =>
    ({
        switchToHttp: () => ({ getRequest: () => ({ headers }) }),
    }) as unknown as ExecutionContext;

describe('safeSecretEquals', () => {
    it('returns true for identical secrets', () => {
        expect(safeSecretEquals('s3cret', 's3cret')).toBe(true);
    });

    it('returns false for different secrets, including different lengths', () => {
        expect(safeSecretEquals('s3cret', 's3creT')).toBe(false);
        expect(safeSecretEquals('short', 'a-much-longer-secret')).toBe(false);
        expect(safeSecretEquals('', 'x')).toBe(false);
    });
});

describe('AdminKeyGuard', () => {
    const guard = new AdminKeyGuard();
    const original = process.env.ADMIN_KEY;

    afterEach(() => {
        process.env.ADMIN_KEY = original;
    });

    it('rejects every request when ADMIN_KEY is not configured', () => {
        delete process.env.ADMIN_KEY;
        expect(() => guard.canActivate(contextWithHeaders({ 'x-admin-key': 'anything' }))).toThrow(UnauthorizedException);
    });

    it('rejects a missing header', () => {
        process.env.ADMIN_KEY = 'expected-key';
        expect(() => guard.canActivate(contextWithHeaders({}))).toThrow(UnauthorizedException);
    });

    it('rejects a wrong key', () => {
        process.env.ADMIN_KEY = 'expected-key';
        expect(() => guard.canActivate(contextWithHeaders({ 'x-admin-key': 'wrong-key' }))).toThrow(UnauthorizedException);
    });

    it('rejects a non-string header (repeated header array)', () => {
        process.env.ADMIN_KEY = 'expected-key';
        expect(() =>
            guard.canActivate(contextWithHeaders({ 'x-admin-key': ['expected-key', 'expected-key'] })),
        ).toThrow(UnauthorizedException);
    });

    it('accepts the right key', () => {
        process.env.ADMIN_KEY = 'expected-key';
        expect(guard.canActivate(contextWithHeaders({ 'x-admin-key': 'expected-key' }))).toBe(true);
    });
});
