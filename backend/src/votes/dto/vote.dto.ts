export interface VoteDto {
    lawId: string;
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
}
