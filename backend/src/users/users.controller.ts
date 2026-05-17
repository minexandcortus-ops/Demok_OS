import { Controller, Get, Patch, Delete, Body, UseGuards, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Citizen } from './citizen.entity';
import { Vote } from '../votes/vote.entity';
import { User } from './user.entity';
import { Constituency } from './constituency.entity';
import { PresidentialVote } from '../surveys/presidential-vote.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/get-user.decorator';
import { AuthService } from '../auth/auth.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
    constructor(
        @InjectRepository(Citizen)
        private readonly citizenRepository: Repository<Citizen>,
        @InjectRepository(Vote)
        private readonly voteRepository: Repository<Vote>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(Constituency)
        private readonly constituencyRepository: Repository<Constituency>,
        @InjectRepository(PresidentialVote)
        private readonly presidentialVoteRepository: Repository<PresidentialVote>,
        private readonly authService: AuthService,
    ) { }

    @Get('profile')
    async getProfile(@CurrentUser() user: User) {
        const citizen = await this.citizenRepository.findOne({
            where: { user: { id: user.id } },
            relations: ['user', 'constituency'],
        });

        if (!citizen) {
            throw new NotFoundException('Citizen profile not found');
        }

        // Decrypt email with shared logic (handles AES and legacy Base64)
        let email = 'Email masqué';
        if (citizen.user && citizen.user.emailEncrypted) {
            email = this.authService.decryptEmail(citizen.user.emailEncrypted);
        }

        // Count real votes from the citizen gamification stats
        const voteCount = citizen.totalVotes || 0;

        const profileData: any = {
            pseudo: citizen.pseudo,
            birthYear: citizen.birthYear,
            postalCode: citizen.postalCode,
            xp: citizen.xp,
            voteCount: voteCount,
            constituency: citizen.constituency ? {
                id: citizen.constituency.id,
                name: citizen.constituency.name,
                code: citizen.constituency.code,
                department: citizen.constituency.department,
                deputy: citizen.constituency.deputyName,
                deputyEmail: citizen.constituency.deputyEmail,
            } : null,
            email: email,
        };

        // Inject available constituencies if we have a postal code
        if (citizen.postalCode) {
            const isDomTom = citizen.postalCode.startsWith('97') || citizen.postalCode.startsWith('98');
            const deptCode = isDomTom ? citizen.postalCode.substring(0, 3) : citizen.postalCode.substring(0, 2);

            const constituencies = await this.constituencyRepository.find({
                where: { department: deptCode },
                order: { name: 'ASC' }
            });

            if (constituencies.length > 1) {
                profileData['availableConstituencies'] = constituencies.map(c => ({
                    id: c.id,
                    name: c.name,
                    deputyName: c.deputyName
                }));
            }
        }

        return profileData;
    }

    @Patch('profile')
    async updateProfile(
        @CurrentUser() user: User,
        @Body() updateData: { email?: string; postalCode?: string; constituencyId?: string }
    ) {
        const citizen = await this.citizenRepository.findOne({
            where: { user: { id: user.id } },
            relations: ['user'],
        });

        if (!citizen) {
            throw new NotFoundException('Citizen profile not found');
        }

        // 1. Update Email
        if (updateData.email) {
            citizen.user.emailEncrypted = this.authService.encryptEmail(updateData.email);
            await this.userRepository.save(citizen.user);
        }

        // 2. Direct Constituency Update (when user selects from dropdown)
        if (updateData.constituencyId) {
            const constituency = await this.constituencyRepository.findOne({
                where: { id: updateData.constituencyId }
            });
            if (constituency) {
                citizen.constituency = constituency;
                await this.citizenRepository.save(citizen);
            }
        }

        // Return updated profile
        return this.getProfile(user);
    }

    @Delete('profile')
    async deleteProfile(@CurrentUser() user: User) {
        const citizen = await this.citizenRepository.findOne({
            where: { user: { id: user.id } },
            relations: ['user'],
        });

        if (!citizen) {
            throw new NotFoundException('Citizen profile not found');
        }

        try {
            console.log(`[DeleteAccount] Deleting data for user ${user.id} / citizen ${citizen.id}`);

            // Delete all Votes by this citizen
            await this.voteRepository.delete({ citizen: { id: citizen.id } });
            console.log('[DeleteAccount] Votes deleted');

            // Delete all PresidentialVotes by this user
            await this.presidentialVoteRepository.delete({ user: { id: citizen.user.id } });
            console.log('[DeleteAccount] PresidentialVotes deleted');

            // Delete the Citizen profile
            await this.citizenRepository.delete({ id: citizen.id });
            console.log('[DeleteAccount] Citizen profile deleted');

            // Delete the base User account
            await this.userRepository.delete({ id: citizen.user.id });
            console.log('[DeleteAccount] User account deleted');

            return { success: true, message: 'Account permanently deleted' };
        } catch (error) {
            console.error('[DeleteAccount] ERROR:', error);
            throw error; // Rethrow to let NestJS handle it but log it first
        }
    }
}
