import { GroupPosition } from './group-vote.entity';
import { VoteChoice } from './vote.types';

export interface GroupVoteData {
    organeRef: string;
    label?: string;
    pour: number;
    contre: number;
    abstention: number;
    nonVotants: number;
    position: GroupPosition;
    /** acteurRef (PAxxxx) des votants, par choix exprimé sur la loi */
    nominatif: Record<'FOR' | 'AGAINST' | 'ABSTAIN', string[]>;
}

const toInt = (v: unknown): number => {
    const n = parseInt(String(v ?? '0'), 10);
    return Number.isFinite(n) ? n : 0;
};

const asArray = <T>(v: T | T[] | null | undefined): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);

const refsOf = (bucket: any): string[] =>
    asArray(bucket?.votant)
        .map((v: any) => v?.acteurRef || v?.uid)
        .filter((r: unknown): r is string => typeof r === 'string' && r.length > 0);

/** Position majoritaire à partir des décomptes (égalité → MIXED). */
export function computePosition(pour: number, contre: number, abstention: number): GroupPosition {
    const max = Math.max(pour, contre, abstention);
    if (max === 0) return GroupPosition.MIXED;
    const leaders = [
        [pour, GroupPosition.FOR],
        [contre, GroupPosition.AGAINST],
        [abstention, GroupPosition.ABSTAIN],
    ].filter(([n]) => n === max);
    return leaders.length === 1 ? (leaders[0][1] as GroupPosition) : GroupPosition.MIXED;
}

const POSITION_FROM_AN: Record<string, GroupPosition> = {
    pour: GroupPosition.FOR,
    contre: GroupPosition.AGAINST,
    abstention: GroupPosition.ABSTAIN,
};

const flipPosition = (p: GroupPosition): GroupPosition =>
    p === GroupPosition.FOR ? GroupPosition.AGAINST : p === GroupPosition.AGAINST ? GroupPosition.FOR : p;

/**
 * Extrait les votes par groupe d'un scrutin de l'open data AN.
 * Schéma : scrutin.ventilationVotes.organe.groupes.groupe[] (ou scrutin.groupes.groupe[]) avec
 * vote.positionMajoritaire, vote.decompteVoix {pour, contre, abstentions, nonVotants} (nombres)
 * et vote.decompteNominatif {pours, contres, abstentions, nonVotants}.votant[] (députés).
 * Pour une motion de rejet, « pour » la motion signifie « contre » la loi : on inverse.
 */
export function extractGroupVotesFromScrutin(scrutin: any, isMotionDeRejet = false): GroupVoteData[] {
    const groupes = asArray(scrutin?.ventilationVotes?.organe?.groupes?.groupe ?? scrutin?.groupes?.groupe);

    return groupes
        .filter((g: any) => g?.organeRef)
        .map((g: any) => {
            const vote = g.vote || {};
            const voix = vote.decompteVoix || {};
            const nominatif = vote.decompteNominatif || {};

            // Repli : ancien chemin lu par le code historique (decompteVoix.pour.votant)
            const forRefs = refsOf(nominatif.pours).length ? refsOf(nominatif.pours) : refsOf(voix.pour);
            const againstRefs = refsOf(nominatif.contres).length ? refsOf(nominatif.contres) : refsOf(voix.contre);
            const abstainRefs = refsOf(nominatif.abstentions).length ? refsOf(nominatif.abstentions) : refsOf(voix.abstentions);

            const count = (v: unknown, refs: string[]) => (typeof v === 'object' && v !== null ? refs.length : toInt(v));
            let pour = count(voix.pour, forRefs);
            let contre = count(voix.contre, againstRefs);
            const abstention = count(voix.abstentions, abstainRefs);
            const nonVotants = toInt(typeof voix.nonVotants === 'object' ? 0 : voix.nonVotants);

            let position = POSITION_FROM_AN[String(vote.positionMajoritaire || '').toLowerCase()] ?? computePosition(pour, contre, abstention);
            let byChoice = { FOR: forRefs, AGAINST: againstRefs, ABSTAIN: abstainRefs };

            if (isMotionDeRejet) {
                [pour, contre] = [contre, pour];
                position = flipPosition(position);
                byChoice = { FOR: againstRefs, AGAINST: forRefs, ABSTAIN: abstainRefs };
            }

            return { organeRef: g.organeRef, pour, contre, abstention, nonVotants, position, nominatif: byChoice };
        });
}

/** Votes par groupe à partir du scraping de secours (choix déjà exprimés sur la loi). */
export function groupVotesFromScraped(
    groups: Array<{ groupName: string; groupOrganId: string; votes: Array<{ deputyAnRef: string; choice: VoteChoice }> }>,
): GroupVoteData[] {
    return (groups || [])
        .filter((g) => g.groupOrganId)
        .map((g) => {
            const nominatif = { FOR: [] as string[], AGAINST: [] as string[], ABSTAIN: [] as string[] };
            for (const v of g.votes || []) {
                if (v.choice in nominatif) nominatif[v.choice].push(v.deputyAnRef);
            }
            const pour = nominatif.FOR.length;
            const contre = nominatif.AGAINST.length;
            const abstention = nominatif.ABSTAIN.length;
            return {
                organeRef: g.groupOrganId,
                label: g.groupName,
                pour,
                contre,
                abstention,
                nonVotants: 0,
                position: computePosition(pour, contre, abstention),
                nominatif,
            };
        });
}

/** Libellé le plus fréquent parmi les étiquettes des députés du groupe (repli : code d'organe). */
export function mostCommonLabel(labels: Array<string | null | undefined>, fallback: string): string {
    const counts = new Map<string, number>();
    for (const label of labels) {
        const l = (label || '').trim();
        if (!l || l === 'Non inscrit') continue;
        counts.set(l, (counts.get(l) || 0) + 1);
    }
    let best = fallback;
    let bestCount = 0;
    for (const [label, n] of counts) {
        if (n > bestCount) {
            best = label;
            bestCount = n;
        }
    }
    return best;
}

/** Un député est « frondeur » s'il vote autrement que la position majoritaire (non MIXED) de son groupe. */
export function isDissident(choice: VoteChoice | string, position: GroupPosition): boolean {
    return position !== GroupPosition.MIXED && choice !== position;
}
