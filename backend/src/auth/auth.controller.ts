import { Controller, Post, Body, Get, Query, UseGuards, HttpCode, ValidationPipe } from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AUTH_THROTTLE_LOGIN, AUTH_THROTTLE_STRICT } from './auth.throttle';
import { AuthService } from './auth.service';
import { OnboardingDto } from './dto/onboarding.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

export class RefreshTokenDto {
    @IsString()
    @MinLength(20)
    @MaxLength(200)
    refreshToken: string;
}

const REFRESH_PIPE = new ValidationPipe({ whitelist: true });

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Get('check-pseudo')
    async checkPseudo(@Query('pseudo') pseudo: string) {
        return this.authService.checkPseudoAvailability(pseudo);
    }

    @Post('register')
    async register(@Body() dto: OnboardingDto) {
        return this.authService.registerUser(dto);
    }

    @Post('login')
    @Throttle({ default: AUTH_THROTTLE_LOGIN })
    async login(@Body() dto: LoginDto) {
        return this.authService.loginUser(dto);
    }

    @Post('forgot-password')
    @Throttle({ default: AUTH_THROTTLE_STRICT })
    async forgotPassword(@Body() dto: ForgotPasswordDto) {
        return this.authService.forgotPassword(dto.email);
    }

    @Post('reset-password')
    @Throttle({ default: AUTH_THROTTLE_STRICT })
    async resetPassword(@Body() dto: ResetPasswordDto) {
        return this.authService.resetPassword(dto.token, dto.newPassword);
    }

    @Post('verify-otp')
    @Throttle({ default: AUTH_THROTTLE_STRICT })
    async verifyOtp(@Body() body: { userId: string; code: string }) {
        return this.authService.verifyOtp(body.userId, body.code);
    }

    @Post('resend-otp')
    @Throttle({ default: AUTH_THROTTLE_STRICT })
    async resendOtp(@Body() body: { userId: string }) {
        return this.authService.resendOtp(body.userId);
    }

    @Post('refresh')
    @HttpCode(200)
    @Throttle({ default: AUTH_THROTTLE_LOGIN })
    async refresh(@Body(REFRESH_PIPE) body: RefreshTokenDto) {
        return this.authService.refresh(body.refreshToken);
    }

    @Post('logout')
    @HttpCode(200)
    async logout(@Body(REFRESH_PIPE) body: RefreshTokenDto) {
        return this.authService.logout(body.refreshToken);
    }
}
