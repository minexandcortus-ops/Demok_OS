export interface LoginDto {
    pseudo: string;
    password: string;
}

export interface LoginResponseDto {
    success: boolean;
    userId?: string;
    citizenId?: string;
    pseudo?: string;
    message?: string;
}
