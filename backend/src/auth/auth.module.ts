import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { User } from '../users/user.entity';
import { Citizen } from '../users/citizen.entity';
import { Constituency } from '../users/constituency.entity';
import { GamificationModule } from '../gamification/gamification.module';
import { NotificationModule } from '../notifications/notification.module';
import { JwtStrategy } from './strategies/jwt.strategy';

/**
 * Module d'authentification et de gestion des profils citoyens.
 * Incorpore la gamification pour récompenser la création de compte.
 */
@Module({
    imports: [
        TypeOrmModule.forFeature([User, Citizen, Constituency]),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: async (configService: ConfigService) => ({
                secret: configService.get<string>('JWT_SECRET'),
                signOptions: { expiresIn: '30d' }, // Session longue pour l'application mobile
            }),
        }),
        GamificationModule,
        NotificationModule,
    ],
    controllers: [AuthController],
    providers: [AuthService, JwtStrategy],
    exports: [AuthService, PassportModule, JwtModule],
})
export class AuthModule { }
