import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { AuthService } from './auth.service';
import { OnboardingDto } from './dto/onboarding.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Controller('auth')
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
    async login(@Body() dto: LoginDto) {
        return this.authService.loginUser(dto);
    }

    @Post('forgot-password')
    async forgotPassword(@Body() dto: ForgotPasswordDto) {
        return this.authService.forgotPassword(dto.email);
    }

    @Post('reset-password')
    async resetPassword(@Body() dto: ResetPasswordDto) {
        return this.authService.resetPassword(dto.token, dto.newPassword);
    }

    @Post('verify-otp')
    async verifyOtp(@Body() body: { userId: string; code: string }) {
        return this.authService.verifyOtp(body.userId, body.code);
    }

    @Post('resend-otp')
    async resendOtp(@Body() body: { userId: string }) {
        return this.authService.resendOtp(body.userId);
    }
}
