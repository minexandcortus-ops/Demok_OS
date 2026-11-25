import { SurveysService } from './surveys.service';
import { TopicPollService } from './topic-poll.service';
import { surveyVoterToken } from '../database/vote-token';

describe('votes without legacy storage', () => {
    it('SurveysService uses the same token as the migration', () => {
        process.env.VOTE_SECRET = 'k';
        const service = new SurveysService({} as any, {} as any, {} as any, {} as any, {} as any);
        expect((service as any).generateVoterToken('cit', 'PRESIDENTIAL_2027')).toBe(surveyVoterToken('k', 'cit', 'PRESIDENTIAL_2027'));
    });

    it('presidential results count the urn only', async () => {
        const urna = {
            count: jest.fn(async ({ where }) => (where.choiceId === 'c1' ? 3 : where.choiceId ? 1 : 4)),
        };
        const candidates = { find: jest.fn().mockResolvedValue([{ id: 'c1', name: 'A' }, { id: 'c2', name: 'B' }]) };
        const service = new SurveysService(candidates as any, {} as any, {} as any, {} as any, urna as any);

        const { totalVotes, results } = await service.getResults();

        expect(totalVotes).toBe(4);
        expect(results.map((r) => [r.candidateId, r.votes, r.percentage])).toEqual([
            ['c1', 3, 75],
            ['c2', 1, 25],
        ]);
    });

    it('presidential hasVoted relies on the registry only', async () => {
        const citizens = { findOne: jest.fn().mockResolvedValue({ id: 'cit' }) };
        const registry = { findOne: jest.fn().mockResolvedValue(null) };
        const service = new SurveysService({} as any, {} as any, citizens as any, registry as any, {} as any);
        await expect(service.hasVoted('user-1')).resolves.toBe(false);
        expect(registry.findOne).toHaveBeenCalledWith({ where: { citizen: { id: 'cit' }, surveyId: 'PRESIDENTIAL_2027' } });
    });

    it('topic poll hasVoted relies on the registry only', async () => {
        const polls = { findOne: jest.fn().mockResolvedValue({ id: 'poll-1', slug: 'p' }) };
        const registry = { findOne: jest.fn().mockResolvedValue({ id: 'r' }) };
        const citizens = { findOne: jest.fn().mockResolvedValue({ id: 'cit' }) };
        const service = new TopicPollService(polls as any, registry as any, {} as any, citizens as any);
        await expect(service.hasVoted('p', 'user-1')).resolves.toBe(true);
        expect(registry.findOne).toHaveBeenCalledWith({ where: { citizen: { id: 'cit' }, surveyId: 'poll-1' } });
    });
});
