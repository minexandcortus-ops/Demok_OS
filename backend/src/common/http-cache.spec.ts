import { Controller, Get, INestApplication, Post, Res } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { cacheControlFor, HttpCacheInterceptor, PRIVATE_NO_CACHE, PublicCache } from './http-cache';
import { PUBLIC_CACHE_KEY } from './http-cache';
import { VotesController } from '../votes/votes.controller';
import { DeputiesController } from '../deputies/deputies.controller';

describe('cacheControlFor', () => {
    it('allows a shared cache for anonymous public reads', () => {
        expect(cacheControlFor(60, false)).toBe('public, max-age=60, stale-while-revalidate=300');
    });

    it('never shares authenticated or unannotated responses', () => {
        expect(cacheControlFor(60, true)).toBe(PRIVATE_NO_CACHE);
        expect(cacheControlFor(undefined, false)).toBe(PRIVATE_NO_CACHE);
    });
});

@Controller('t')
class TestController {
    @Get('public')
    @PublicCache(120)
    publicRead() {
        return { ok: true };
    }

    @Get('private')
    privateRead() {
        return { ok: true };
    }

    @Post('public')
    @PublicCache(120)
    write() {
        return { ok: true };
    }

    @Get('custom')
    @PublicCache(120)
    custom(@Res() res: any) {
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.send('img');
    }
}

describe('HttpCacheInterceptor', () => {
    let app: INestApplication;

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            controllers: [TestController],
            providers: [{ provide: APP_INTERCEPTOR, useClass: HttpCacheInterceptor }],
        }).compile();
        app = moduleRef.createNestApplication();
        await app.init();
    });

    afterAll(() => app.close());

    it('caches anonymous reads of annotated routes and varies on Authorization', async () => {
        const res = await request(app.getHttpServer()).get('/t/public').expect(200);
        expect(res.headers['cache-control']).toBe('public, max-age=120, stale-while-revalidate=600');
        expect(res.headers['vary']).toMatch(/Authorization/);
    });

    it('keeps authenticated reads private', async () => {
        const res = await request(app.getHttpServer()).get('/t/public').set('Authorization', 'Bearer x').expect(200);
        expect(res.headers['cache-control']).toBe(PRIVATE_NO_CACHE);
    });

    it('marks other reads as private, no-cache', async () => {
        const res = await request(app.getHttpServer()).get('/t/private').expect(200);
        expect(res.headers['cache-control']).toBe(PRIVATE_NO_CACHE);
    });

    it('leaves writes alone', async () => {
        const res = await request(app.getHttpServer()).post('/t/public').expect(201);
        expect(res.headers['cache-control']).toBeUndefined();
    });

    it('keeps a Cache-Control set by the handler itself', async () => {
        const res = await request(app.getHttpServer()).get('/t/custom').expect(200);
        expect(res.headers['cache-control']).toBe('public, max-age=86400');
    });
});

describe('public cache annotations on real controllers', () => {
    const maxAge = (proto: any, method: string) => Reflect.getMetadata(PUBLIC_CACHE_KEY, proto[method]);

    it('caches the public law feed but never the per-user vote check', () => {
        expect(maxAge(VotesController.prototype, 'getLaws')).toBe(60);
        expect(maxAge(VotesController.prototype, 'getLaw')).toBe(60);
        expect(maxAge(VotesController.prototype, 'checkVote')).toBeUndefined();
        expect(maxAge(VotesController.prototype, 'getFavoriteLawIds')).toBeUndefined();
    });

    it('caches deputy pages', () => {
        const annotated = Object.getOwnPropertyNames(DeputiesController.prototype).filter((m) =>
            maxAge(DeputiesController.prototype, m),
        );
        expect(annotated.length).toBeGreaterThanOrEqual(5);
    });
});
