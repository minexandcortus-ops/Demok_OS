import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { Citizen } from './citizen.entity';
import { Deputy } from '../votes/deputy.entity';
import { UsersController } from './users.controller';
import { PresidentialVote } from '../surveys/presidential-vote.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([User, Citizen, Deputy, PresidentialVote]),
        AuthModule,
    ],
    controllers: [UsersController],
    exports: [TypeOrmModule],
})
export class UsersModule { }
