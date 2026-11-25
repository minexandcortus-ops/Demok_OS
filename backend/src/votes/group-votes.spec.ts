import { computePosition, extractGroupVotesFromScrutin, groupVotesFromScraped, isDissident, mostCommonLabel } from './group-votes';
import { GroupPosition } from './group-vote.entity';
import { VoteChoice } from './vote.types';
import { readFileSync } from 'fs';
import { join } from 'path';

const scrutin = JSON.parse(readFileSync(join(__dirname, '__fixtures__', 'scrutin-an.json'), 'utf8'));

describe('extractGroupVotesFromScrutin (AN open data schema)', () => {
    const groups = extractGroupVotesFromScrutin(scrutin);

    it('reads every group of ventilationVotes', () => {
        expect(groups.map((g) => g.organeRef)).toEqual(['PO845401', 'PO845413', 'PO845470']);
    });

    it('reads the counts from decompteVoix and the official majority position', () => {
        expect(groups[0]).toMatchObject({ pour: 3, contre: 1, abstention: 0, nonVotants: 0, position: GroupPosition.FOR });
        expect(groups[1]).toMatchObject({ pour: 0, contre: 2, nonVotants: 1, position: GroupPosition.AGAINST });
        // positionMajoritaire fait foi, même si les décomptes diffèrent
        expect(groups[2].position).toBe(GroupPosition.ABSTAIN);
    });

    it('reads the deputies from decompteNominatif, single votant objects included', () => {
        expect(groups[0].nominatif).toEqual({ FOR: ['PA1001', 'PA1002', 'PA1003'], AGAINST: ['PA1004'], ABSTAIN: [] });
        expect(groups[2].nominatif.ABSTAIN).toEqual(['PA3003']);
    });

    it('inverts choices for a motion de rejet (voting for the motion = against the law)', () => {
        const [first] = extractGroupVotesFromScrutin(scrutin, true);
        expect(first).toMatchObject({ pour: 1, contre: 3, position: GroupPosition.AGAINST });
        expect(first.nominatif.FOR).toEqual(['PA1004']);
        expect(first.nominatif.AGAINST).toEqual(['PA1001', 'PA1002', 'PA1003']);
    });

    it('still supports the legacy scrutin.groupes path and computes the position when missing', () => {
        const legacy = {
            groupes: {
                groupe: {
                    organeRef: 'PO1',
                    vote: { decompteVoix: { pour: { votant: [{ acteurRef: 'PA1' }, { acteurRef: 'PA2' }] }, contre: '1' } },
                },
            },
        };
        const [g] = extractGroupVotesFromScrutin(legacy);
        expect(g).toMatchObject({ organeRef: 'PO1', pour: 2, contre: 1, position: GroupPosition.FOR });
        expect(g.nominatif.FOR).toEqual(['PA1', 'PA2']);
    });

    it('returns nothing for a scrutin without groups', () => {
        expect(extractGroupVotesFromScrutin({ uid: 'x' })).toEqual([]);
    });
});

describe('groupVotesFromScraped', () => {
    it('counts the scraped votes and keeps the group name', () => {
        const [g] = groupVotesFromScraped([
            {
                groupName: 'Rassemblement National',
                groupOrganId: 'PO845401',
                votes: [
                    { deputyAnRef: 'PA1', choice: VoteChoice.AGAINST },
                    { deputyAnRef: 'PA2', choice: VoteChoice.AGAINST },
                    { deputyAnRef: 'PA3', choice: VoteChoice.FOR },
                ],
            },
        ]);
        expect(g).toMatchObject({ label: 'Rassemblement National', pour: 1, contre: 2, position: GroupPosition.AGAINST });
    });
});

describe('helpers', () => {
    it('computePosition reports ties as MIXED', () => {
        expect(computePosition(2, 2, 0)).toBe(GroupPosition.MIXED);
        expect(computePosition(0, 0, 0)).toBe(GroupPosition.MIXED);
        expect(computePosition(0, 0, 3)).toBe(GroupPosition.ABSTAIN);
    });

    it('mostCommonLabel ignores empty and "Non inscrit" labels', () => {
        expect(mostCommonLabel(['Socialistes', 'Socialistes', 'Non inscrit', null, 'Autre'], 'PO1')).toBe('Socialistes');
        expect(mostCommonLabel([null, 'Non inscrit'], 'PO1')).toBe('PO1');
    });

    it('isDissident compares with the group position, never for MIXED', () => {
        expect(isDissident(VoteChoice.AGAINST, GroupPosition.FOR)).toBe(true);
        expect(isDissident(VoteChoice.FOR, GroupPosition.FOR)).toBe(false);
        expect(isDissident(VoteChoice.AGAINST, GroupPosition.MIXED)).toBe(false);
    });
});
