import { fromGroupPosition, fromVoteChoice, PositionSourceType, resolvePosition } from './candidate-positions';
import { LawPosition } from './candidate-law-position.entity';

const declared = {
    position: LawPosition.CONTRE,
    sourceType: 'DECLARATION' as const,
    sourceUrl: 'https://media.example.fr/interview',
    quote: 'Je voterais contre ce texte.',
    sourceDate: '2026-10-02',
};
const group = { position: 'FOR', label: 'Droite Républicaine' };

describe('resolvePosition', () => {
    it('prefers the personal vote of a candidate who is a deputy, recalling the group position', () => {
        const view = resolvePosition({ personalVote: { choice: 'AGAINST' }, declared, groupVote: group });
        expect(view).toMatchObject({
            position: LawPosition.CONTRE,
            sourceType: PositionSourceType.VOTE_PERSONNEL,
            groupPosition: LawPosition.POUR,
            groupLabel: 'Droite Républicaine',
        });
    });

    it('uses a sourced declaration before the group proxy', () => {
        const view = resolvePosition({ declared, groupVote: group });
        expect(view).toMatchObject({
            position: LawPosition.CONTRE,
            sourceType: PositionSourceType.DECLARATION,
            sourceUrl: 'https://media.example.fr/interview',
            quote: 'Je voterais contre ce texte.',
            sourceDate: '2026-10-02',
            groupPosition: LawPosition.POUR,
        });
    });

    it('labels program-based positions as such', () => {
        expect(resolvePosition({ declared: { ...declared, sourceType: 'PROGRAMME' } }).sourceLabel).toBe('Son programme');
    });

    it('falls back to the group vote, explicitly not as a personal position', () => {
        const view = resolvePosition({ groupVote: group });
        expect(view.sourceType).toBe(PositionSourceType.VOTE_GROUPE);
        expect(view.position).toBe(LawPosition.POUR);
        expect(view.sourceLabel).toContain('pas une position personnelle');
        expect(view.groupPosition).toBeNull();
    });

    it('reports INCONNU when nothing is known (never guessed)', () => {
        expect(resolvePosition({})).toMatchObject({ position: 'INCONNU', sourceType: PositionSourceType.INCONNU });
    });

    it('maps vote choices and group ties', () => {
        expect(fromVoteChoice('ABSTAIN')).toBe(LawPosition.ABSTENTION);
        expect(fromVoteChoice('???')).toBe('INCONNU');
        expect(fromGroupPosition('MIXED')).toBe(LawPosition.NUANCE);
    });
});
