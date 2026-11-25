import { BadRequestException, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AdminClassificationController } from './admin-classification.controller';
import { AdminKeyGuard } from './admin-key.guard';
import { CategorizationService } from '../laws/categorization.service';

const LAW_ID = '3f2b8c1e-9a4d-4c3b-8e2f-1a2b3c4d5e6f';

describe('AdminClassificationController', () => {
    let app: INestApplication;
    const categorization = {
        setManualClassification: jest.fn(async (_id, slugs, territories, locked) => ({
            categories: slugs.map((slug: string) => ({ slug })),
            territories,
            categoriesLocked: locked,
        })),
    };

    beforeAll(async () => {
        process.env.ADMIN_KEY = 'k';
        const moduleRef = await Test.createTestingModule({
            controllers: [AdminClassificationController],
            providers: [{ provide: CategorizationService, useValue: categorization }, AdminKeyGuard],
        }).compile();
        app = moduleRef.createNestApplication();
        await app.init();
    });

    afterAll(() => app.close());

    const patch = (body: object, key = 'k') =>
        request(app.getHttpServer()).patch(`/admin/laws/${LAW_ID}/classification`).set('x-admin-key', key).send(body);

    it('requires the admin key', async () => {
        await patch({ categorySlugs: ['justice'], territories: [] }, 'wrong').expect(401);
    });

    it('stores a manual classification, locked by default', async () => {
        const res = await patch({ categorySlugs: ['justice', 'securite'], territories: ['CORSE'] }).expect(200);
        expect(categorization.setManualClassification).toHaveBeenCalledWith(LAW_ID, ['justice', 'securite'], ['CORSE'], true);
        expect(res.body).toMatchObject({ success: true, categories: ['justice', 'securite'], territories: ['CORSE'], categoriesLocked: true });
    });

    it.each([
        ['no theme', { categorySlugs: [], territories: [] }],
        ['more than 3 themes', { categorySlugs: ['a', 'b', 'c', 'd'], territories: [] }],
        ['unknown territory', { categorySlugs: ['justice'], territories: ['ATLANTIDE'] }],
    ])('rejects %s', async (_label, body) => {
        await patch(body).expect(400);
    });

    it('turns service errors into 400', async () => {
        categorization.setManualClassification.mockRejectedValueOnce(new Error('Au moins un thème valide est requis'));
        const res = await patch({ categorySlugs: ['inconnu'], territories: [] }).expect(400);
        expect(res.body.message).toContain('thème');
        expect(BadRequestException).toBeDefined();
    });
});
