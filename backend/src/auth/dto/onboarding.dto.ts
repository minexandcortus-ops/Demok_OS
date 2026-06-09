export interface OnboardingDto {
    pseudo: string;
    birthYear: number;
    postalCode: string;
    constituencyCode?: string;
    email: string;
    password: string;
}

export interface OnboardingResponseDto {
    success: boolean;
    userId?: string;
    message?: string;
    needsConstituencyChoice?: boolean;
    constituencyOptions?: Array<{ id: string; name: string }>;
}
