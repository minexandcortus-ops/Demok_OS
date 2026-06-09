import { Controller, Get, Patch, Delete, Body, UseGuards, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Citizen } from './citizen.entity';
import { User } from './user.entity';
import { Deputy } from '../votes/deputy.entity';
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
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(Deputy)
        private readonly deputyRepository: Repository<Deputy>,
        @InjectRepository(PresidentialVote)
        private readonly presidentialVoteRepository: Repository<PresidentialVote>,
        private readonly authService: AuthService,
    ) { }

    @Get('profile')
    async getProfile(@CurrentUser() user: User) {
        const citizen = await this.citizenRepository.findOne({
            where: { user: { id: user.id } },
            relations: ['user'],
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

        let constituencyData = null;
        if (citizen.constituencyCode) {
            const deputy = await this.deputyRepository.findOne({ where: { constituencyCode: citizen.constituencyCode } });
            if (deputy) {
                constituencyData = {
                    id: deputy.id,
                    name: deputy.department,
                    code: deputy.constituencyCode,
                    department: deputy.constituencyCode.split('-')[0],
                    deputy: deputy.fullName,
                    deputyEmail: null,
                };
            }
        }

        const profileData: any = {
            pseudo: citizen.pseudo,
            birthYear: citizen.birthYear,
            postalCode: citizen.postalCode,
            xp: citizen.xp,
            voteCount: voteCount,
            constituency: constituencyData,
            email: email,
            notifyLawResults: citizen.user?.notifyLawResults ?? true,
            notifySurveyResults: citizen.user?.notifySurveyResults ?? true,
            notifyNewSurveys: citizen.user?.notifyNewSurveys ?? true,
        };

        // Inject available constituencies if we have a postal code
        if (citizen.postalCode) {
            const isDomTom = citizen.postalCode.startsWith('97') || citizen.postalCode.startsWith('98');
            const deptCode = isDomTom ? citizen.postalCode.substring(0, 3) : citizen.postalCode.substring(0, 2);

            const deputies = await this.deputyRepository.createQueryBuilder('deputy')
                .where('deputy.constituencyCode LIKE :deptCode', { deptCode: `${deptCode}-%` })
                .andWhere('deputy.isActive = :isActive', { isActive: true })
                .orderBy('deputy.constituencyCode', 'ASC')
                .getMany();

            if (deputies.length > 0) {
                profileData['availableConstituencies'] = deputies.map(d => ({
                    id: d.constituencyCode, // Using code as ID
                    name: d.department,
                    deputyName: d.fullName
                }));
            }
        }

        return profileData;
    }

    @Patch('profile')
    async updateProfile(
        @CurrentUser() user: User,
        @Body() updateData: { 
            email?: string; 
            postalCode?: string; 
            constituencyCode?: string;
            notifyLawResults?: boolean;
            notifySurveyResults?: boolean;
            notifyNewSurveys?: boolean;
        }
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
        if (updateData.constituencyCode) {
            citizen.constituencyCode = updateData.constituencyCode;
            await this.citizenRepository.save(citizen);
        }

        // 3. Update Notification Preferences
        let userNeedsSave = false;
        if (updateData.notifyLawResults !== undefined) {
            citizen.user.notifyLawResults = updateData.notifyLawResults;
            userNeedsSave = true;
        }
        if (updateData.notifySurveyResults !== undefined) {
            citizen.user.notifySurveyResults = updateData.notifySurveyResults;
            userNeedsSave = true;
        }
        if (updateData.notifyNewSurveys !== undefined) {
            citizen.user.notifyNewSurveys = updateData.notifyNewSurveys;
            userNeedsSave = true;
        }

        if (userNeedsSave) {
            await this.userRepository.save(citizen.user);
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

    @Patch('fcm-token')
    async updateFcmToken(
        @CurrentUser() user: User,
        @Body() body: { fcmToken: string }
    ) {
        user.fcmToken = body.fcmToken;
        await this.userRepository.save(user);
        return { success: true };
    }
}
