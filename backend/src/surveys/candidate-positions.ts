import { GroupPosition } from '../votes/group-vote.entity';
import { VoteChoice } from '../votes/vote.types';
import { LawPosition } from './candidate-law-position.entity';

/** Type de source, du plus fiable au moins direct. */
export enum PositionSourceType {
    VOTE_PERSONNEL = 'VOTE_PERSONNEL',
    DECLARATION = 'DECLARATION',
    PROGRAMME = 'PROGRAMME',
    VOTE_GROUPE = 'VOTE_GROUPE',
    INCONNU = 'INCONNU',
}

export type ResolvedPosition = LawPosition | 'INCONNU';

export interface PositionEvidence {
    personalVote?: { choice: VoteChoice | string; scrutinId?: string | null } | null;
    declared?: {
        position: LawPosition;
        sourceType: 'DECLARATION' | 'PROGRAMME';
        sourceUrl: string;
        quote?: string | null;
        sourceDate: string;
        verifiedAt?: Date | null;
    } | null;
    groupVote?: { position: GroupPosition | string; label: string } | null;
}

export interface CandidatePositionView {
    position: ResolvedPosition;
    sourceType: PositionSourceType;
    /** Phrase explicative affichée telle quelle (indique toujours l'origine) */
    sourceLabel: string;
    sourceUrl: string | null;
    quote: string | null;
    sourceDate: string | null;
    /** Position du groupe, rappelée à titre indicatif quand la source principale est autre */
    groupPosition: ResolvedPosition | null;
    groupLabel: string | null;
}

export const fromVoteChoice = (choice: string): ResolvedPosition =>
    choice === 'FOR' ? LawPosition.POUR
        : choice === 'AGAINST' ? LawPosition.CONTRE
        : choice === 'ABSTAIN' ? LawPosition.ABSTENTION
        : 'INCONNU';

export const fromGroupPosition = (position: string): ResolvedPosition =>
    position === 'MIXED' ? LawPosition.NUANCE : fromVoteChoice(position);

/**
 * Choisit la source principale d'une position :
 * 1. le vote personnel du candidat (s'il est ou a été député) ;
 * 2. sa déclaration ou son programme, sourcés et vérifiés ;
 * 3. à défaut, le vote du groupe de sa formation, présenté comme tel ;
 * sinon INCONNU. Rien n'est jamais déduit par IA.
 */
export function resolvePosition(evidence: PositionEvidence): CandidatePositionView {
    const group = evidence.groupVote
        ? { groupPosition: fromGroupPosition(evidence.groupVote.position), groupLabel: evidence.groupVote.label }
        : { groupPosition: null, groupLabel: null };

    if (evidence.personalVote) {
        return {
            position: fromVoteChoice(evidence.personalVote.choice),
            sourceType: PositionSourceType.VOTE_PERSONNEL,
            sourceLabel: 'Son vote de député sur ce texte',
            sourceUrl: null,
            quote: null,
            sourceDate: null,
            ...group,
        };
    }

    if (evidence.declared) {
        const d = evidence.declared;
        return {
            position: d.position,
            sourceType: d.sourceType === 'PROGRAMME' ? PositionSourceType.PROGRAMME : PositionSourceType.DECLARATION,
            sourceLabel: d.sourceType === 'PROGRAMME' ? 'Son programme' : 'Déclaration publique',
            sourceUrl: d.sourceUrl,
            quote: d.quote ?? null,
            sourceDate: d.sourceDate,
            ...group,
        };
    }

    if (evidence.groupVote) {
        return {
            position: fromGroupPosition(evidence.groupVote.position),
            sourceType: PositionSourceType.VOTE_GROUPE,
            sourceLabel: `Vote du groupe ${evidence.groupVote.label} (pas une position personnelle)`,
            sourceUrl: null,
            quote: null,
            sourceDate: null,
            groupPosition: null,
            groupLabel: evidence.groupVote.label,
        };
    }

    return {
        position: 'INCONNU',
        sourceType: PositionSourceType.INCONNU,
        sourceLabel: 'Position non connue',
        sourceUrl: null,
        quote: null,
        sourceDate: null,
        groupPosition: null,
        groupLabel: null,
    };
}
