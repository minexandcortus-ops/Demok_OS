import { buildTypeOrmOptions, ENTITIES, shouldSynchronize } from './typeorm.config';
import { InitialSchema1795599460013 } from './migrations/1795599460013-InitialSchema';

describe('shouldSynchronize', () => {
    it('keeps the historical behaviour: synchronize outside production', () => {
        expect(shouldSynchronize({})).toBe(true);
        expect(shouldSynchronize({ NODE_ENV: 'development' })).toBe(true);
        expect(shouldSynchronize({ NODE_ENV: 'production' })).toBe(false);
    });

    it('lets DB_SYNCHRONIZE override NODE_ENV', () => {
        expect(shouldSynchronize({ DB_SYNCHRONIZE: 'false' })).toBe(false);
        expect(shouldSynchronize({ NODE_ENV: 'production', DB_SYNCHRONIZE: 'true' })).toBe(true);
    });
});

describe('buildTypeOrmOptions', () => {
    it('runs migrations exactly when synchronize is off', () => {
        const prod = buildTypeOrmOptions({ DB_SYNCHRONIZE: 'false' });
        expect(prod.synchronize).toBe(false);
        expect(prod.migrationsRun).toBe(true);

        const dev = buildTypeOrmOptions({});
        expect(dev.synchronize).toBe(true);
        expect(dev.migrationsRun).toBe(false);
    });

    it('reads connection settings from the environment', () => {
        const options = buildTypeOrmOptions({
            DATABASE_HOST: 'db',
            DATABASE_PORT: '6543',
            DATABASE_USER: 'u',
            DATABASE_PASSWORD: 'p',
            DATABASE_NAME: 'n',
        }) as any;
        expect(options).toMatchObject({ host: 'db', port: 6543, username: 'u', password: 'p', database: 'n' });
    });

    it('registers every entity and a migrations glob that excludes .d.ts files', () => {
        const options = buildTypeOrmOptions({}) as any;
        expect(options.entities).toBe(ENTITIES);
        expect(ENTITIES.length).toBe(19);
        expect(options.migrations[0]).toMatch(/migrations[/\\]\*\.ts$/);
        expect(options.migrationsTableName).toBe('typeorm_migrations');
    });
});

describe('InitialSchema baseline', () => {
    it('is a no-op on databases already created by synchronize', async () => {
        const queryRunner = { hasTable: jest.fn().mockResolvedValue(true), query: jest.fn() };
        await new InitialSchema1795599460013().up(queryRunner as any);
        expect(queryRunner.hasTable).toHaveBeenCalledWith('law');
        expect(queryRunner.query).not.toHaveBeenCalled();
    });

    it('creates the schema (with uuid-ossp) on an empty database', async () => {
        const queryRunner = { hasTable: jest.fn().mockResolvedValue(false), query: jest.fn() };
        await new InitialSchema1795599460013().up(queryRunner as any);
        expect(queryRunner.query.mock.calls[0][0]).toContain('uuid-ossp');
        expect(queryRunner.query.mock.calls.some(([sql]) => /CREATE TABLE "law"/.test(sql))).toBe(true);
    });

    it('refuses to be reverted (would drop production data)', async () => {
        await expect(new InitialSchema1795599460013().down()).rejects.toThrow();
    });
});
