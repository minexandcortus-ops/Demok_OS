import { GameConstants } from './game-constants';

describe('GameConstants', () => {
    it('defines strictly positive XP rewards', () => {
        for (const [key, value] of Object.entries(GameConstants.XP)) {
            expect({ key, positive: value > 0 }).toEqual({ key, positive: true });
        }
    });

    it('rewards a regular vote more than a fast-vote bonus', () => {
        expect(GameConstants.XP.VOTE).toBeGreaterThan(GameConstants.XP.VOTE_FAST);
    });

    it('defines streak cycles of at least one period', () => {
        expect(GameConstants.STREAKS.WEEKLY_CYCLE).toBeGreaterThanOrEqual(1);
        expect(GameConstants.STREAKS.DAILY_CYCLE).toBeGreaterThanOrEqual(1);
    });
});
