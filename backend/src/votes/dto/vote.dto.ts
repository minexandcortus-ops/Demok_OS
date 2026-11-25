import { IsEnum, IsUUID } from 'class-validator';
import { VoteChoice } from '../vote.types';

export class VoteDto {
    @IsUUID('4', { message: 'Identifiant de loi invalide' })
    lawId: string;

    @IsEnum(VoteChoice, { message: 'Choix de vote invalide (FOR, AGAINST ou ABSTAIN)' })
    choice: 'FOR' | 'AGAINST' | 'ABSTAIN';
}

export interface VoteResponseDto {
    success: boolean;
    message?: string;
    statistics?: {
        totalVotes: number;
        forPercentage: number;
        againstPercentage: number;
        abstainPercentage: number;
    };
    deputyVote?: {
        choice: 'FOR' | 'AGAINST' | 'ABSTAIN';
        deputyName: string;
        agreement: boolean; // Does user vote match deputy vote?
    };
    xpGains?: Array<{ amount: number; reason: string }>;
    userVote?: string;
}
