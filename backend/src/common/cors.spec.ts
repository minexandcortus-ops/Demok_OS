import { INestApplication, Controller, Get } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { buildCorsOrigin, parseAllowedOrigins } from './cors';

const decide = (env: NodeJS.ProcessEnv, origin: string | undefined) =>
    new Promise<boolean>((resolve, reject) =>
        buildCorsOrigin(env)(origin, (err, allow) => (err ? reject(err) : resolve(!!allow))),
    );

describe('parseAllowedOrigins', () => {
    it('uses CORS_ORIGINS strictly, trimming spaces and trailing slashes', () => {
        const { origins, allowLocalhost } = parseAllowedOrigins({
            CORS_ORIGINS: 'https://demok.fr/, https://www.demok.fr ,,',
        });
        expect([...origins]).toEqual(['https://demok.fr', 'https://www.demok.fr']);
        expect(allowLocalhost).toBe(false);
    });

    it('falls back to FRONTEND_URL plus localhost in development', () => {
        const { origins, allowLocalhost } = parseAllowedOrigins({ FRONTEND_URL: 'http://localhost:8080/' });
        expect([...origins]).toEqual(['http://localhost:8080']);
        expect(allowLocalhost).toBe(true);
    });
});

describe('buildCorsOrigin', () => {
    const prod = { CORS_ORIGINS: 'https://demok.fr,https://demok-ba1a1.web.app' };

    it('allows whitelisted origins', async () => {
        await expect(decide(prod, 'https://demok.fr')).resolves.toBe(true);
        await expect(decide(prod, 'https://demok-ba1a1.web.app')).resolves.toBe(true);
    });

    it('refuses other origins, including look-alikes and localhost in strict mode', async () => {
        await expect(decide(prod, 'https://evil.example')).resolves.toBe(false);
        await expect(decide(prod, 'https://demok.fr.evil.example')).resolves.toBe(false);
        await expect(decide(prod, 'http://demok.fr')).resolves.toBe(false);
        await expect(decide(prod, 'http://localhost:8080')).resolves.toBe(false);
    });

    it('allows requests without Origin (server-to-server, curl)', async () => {
        await expect(decide(prod, undefined)).resolves.toBe(true);
    });

    it('allows any localhost port in development mode only', async () => {
        await expect(decide({}, 'http://localhost:53211')).resolves.toBe(true);
        await expect(decide({}, 'http://127.0.0.1:3000')).resolves.toBe(true);
        await expect(decide({}, 'http://localhost.evil.example')).resolves.toBe(false);
    });
});

@Controller('ping')
class PingController {
    @Get()
    ping() {
        return { ok: true };
    }
}

describe('CORS headers over HTTP', () => {
    let app: INestApplication;

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({ controllers: [PingController] }).compile();
        app = moduleRef.createNestApplication();
        app.enableCors({ origin: buildCorsOrigin({ CORS_ORIGINS: 'https://demok.fr' }), credentials: true });
        await app.init();
    });

    afterAll(() => app.close());

    it('reflects an allowed origin', async () => {
        const res = await request(app.getHttpServer()).get('/ping').set('Origin', 'https://demok.fr').expect(200);
        expect(res.headers['access-control-allow-origin']).toBe('https://demok.fr');
        expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('sends no CORS header to a foreign origin', async () => {
        const res = await request(app.getHttpServer()).get('/ping').set('Origin', 'https://evil.example');
        expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
});
