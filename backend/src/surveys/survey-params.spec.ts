import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { SurveysController } from './surveys.controller';
import { SurveysService } from './surveys.service';
import { TopicPollController } from './topic-poll.controller';
import { TopicPollService } from './topic-poll.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { createValidationPipe } from '../common/validation';

describe('Survey vote parameters', () => {
    let app: INestApplication;
    const surveysService = { vote: jest.fn().mockResolvedValue({ ok: true }) };
    const pollService = { vote: jest.fn().mockResolvedValue({ ok: true }) };

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            controllers: [SurveysController, TopicPollController],
            providers: [
                { provide: SurveysService, useValue: surveysService },
                { provide: TopicPollService, useValue: pollService },
            ],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue({
                canActivate: (ctx) => {
                    ctx.switchToHttp().getRequest().user = { id: 'user-1' };
                    return true;
                },
            })
            .compile();
        app = moduleRef.createNestApplication();
        app.useGlobalPipes(createValidationPipe());
        await app.init();
    });

    afterAll(() => app.close());

    it('rejects a non-uuid candidate id', async () => {
        await request(app.getHttpServer()).post('/surveys/presidential/vote').send({ candidateId: 'abc' }).expect(400);
        expect(surveysService.vote).not.toHaveBeenCalled();
    });

    it('accepts a uuid candidate id', async () => {
        await request(app.getHttpServer())
            .post('/surveys/presidential/vote')
            .send({ candidateId: '3f2b8c1e-9a4d-4c3b-8e2f-1a2b3c4d5e6f' })
            .expect(201);
        expect(surveysService.vote).toHaveBeenCalledWith('user-1', '3f2b8c1e-9a4d-4c3b-8e2f-1a2b3c4d5e6f');
    });

    it('rejects an unknown topic poll choice', async () => {
        await request(app.getHttpServer()).post('/surveys/polls/some-poll/vote').send({ choice: 'peut-etre' }).expect(400);
        expect(pollService.vote).not.toHaveBeenCalled();
    });

    it.each(['pour', 'neutre', 'contre'])('accepts the topic poll choice %s', async (choice) => {
        await request(app.getHttpServer()).post('/surveys/polls/some-poll/vote').send({ choice }).expect(201);
    });
});
