import { Injectable, ConflictException, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { User } from '../users/user.entity';
import { Citizen } from '../users/citizen.entity';
import { Constituency } from '../users/constituency.entity';
import { OnboardingDto } from './dto/onboarding.dto';
import { LoginDto } from './dto/login.dto';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { GamificationService } from '../gamification/gamification.service';
import { MailService } from '../notifications/mail/mail.service';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);
    private readonly BCRYPT_ROUNDS = 12;

    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(Citizen)
        private readonly citizenRepository: Repository<Citizen>,
        @InjectRepository(Constituency)
        private readonly constituencyRepository: Repository<Constituency>,
        private readonly gamificationService: GamificationService,
        private readonly mailService: MailService,
        private readonly jwtService: JwtService,
    ) { }

    /**
     * Register a new user with onboarding data
     */
    async registerUser(dto: OnboardingDto) {
        const trimmedPseudo = dto.pseudo.trim();
        
        if (trimmedPseudo.length > 20 || trimmedPseudo.includes(' ')) {
            throw new ConflictException('Le pseudo est invalide (max 20 caractères, sans espace)');
        }

        // Check if email already exists
        const emailHash = this.hashEmail(dto.email);
        const existingUser = await this.userRepository.findOne({
            where: { emailHash },
        });

        if (existingUser) {
            if (existingUser.emailVerified) {
                throw new ConflictException('Email déjà utilisé');
            }
            // L'utilisateur n'a pas confirmé son email, on supprime son compte pour lui permettre de recommencer
            const oldCitizen = await this.citizenRepository.findOne({ where: { user: { id: existingUser.id } } });
            if (oldCitizen) {
                await this.citizenRepository.remove(oldCitizen);
            }
            await this.userRepository.remove(existingUser);
        }

        const existingCitizen = await this.citizenRepository.findOne({
            where: { pseudo: trimmedPseudo },
            relations: ['user']
        });

        if (existingCitizen) {
            if (existingCitizen.user && existingCitizen.user.emailVerified) {
                throw new ConflictException('Pseudo déjà utilisé');
            }
            // Le pseudo est bloqué par un compte non vérifié (possiblement l'utilisateur lui-même), on le libère
            await this.citizenRepository.remove(existingCitizen);
            if (existingCitizen.user) {
                await this.userRepository.remove(existingCitizen.user);
            }
        }

        // For MVP: Simple constituency lookup by postal code prefix (department)
        const department = dto.postalCode.substring(0, 2);
        const constituency = await this.constituencyRepository.findOne({
            where: { department },
        });

        // Create User
        const user = new User();
        user.emailHash = emailHash;
        user.emailEncrypted = this.encryptEmail(dto.email); // In production, use proper AES
        user.passwordHash = await this.hashPassword(dto.password);
        user.onboardingCompleted = true;

        // Generate OTP for email verification
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        user.otpCode = otpCode;
        user.otpExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
        user.emailVerified = false;

        const savedUser = await this.userRepository.save(user);

        // Create Citizen profile
        const citizen = new Citizen();
        citizen.user = savedUser;
        citizen.pseudo = trimmedPseudo;
        citizen.birthYear = dto.birthYear;
        citizen.postalCode = dto.postalCode;
        citizen.constituencyId = constituency?.id || null;

        await this.citizenRepository.save(citizen);

        // Send OTP email (non-blocking — don't fail registration if email fails)
        try {
            await this.mailService.sendOtpEmail(dto.email, otpCode, trimmedPseudo);
        } catch (mailError) {
            this.logger.error(`Failed to send OTP email to ${dto.email}: ${mailError.message}`);
        }

        return {
            success: true,
            userId: savedUser.id,
            message: 'Registration successful — check your email for the verification code.',
        };
    }

    /**
     * Verifies the OTP code sent by email after registration
     */
    async verifyOtp(userId: string, code: string) {
        const user = await this.userRepository.findOne({ where: { id: userId } });

        if (!user) {
            throw new BadRequestException('Utilisateur introuvable');
        }

        if (user.emailVerified) {
            return { success: true, message: 'Email déjà vérifié.' };
        }

        if (!user.otpCode || !user.otpExpires || user.otpExpires < new Date()) {
            throw new BadRequestException('Le code a expiré. Demande un nouveau code.');
        }

        if (user.otpCode !== code.trim()) {
            throw new BadRequestException('Code incorrect.');
        }

        // Mark as verified, clear OTP
        user.emailVerified = true;
        user.otpCode = null;
        user.otpExpires = null;
        await this.userRepository.save(user);

        const accessToken = this.generateToken(user);
        
        // Fetch citizen for complete response
        const citizen = await this.citizenRepository.findOne({
            where: { user: { id: user.id } },
        });

        return { 
            success: true, 
            message: 'Email vérifié avec succès !',
            userId: user.id,
            citizenId: citizen?.id,
            pseudo: citizen?.pseudo,
            email: this.decryptEmail(user.emailEncrypted),
            birthYear: citizen?.birthYear,
            accessToken,
        };
    }

    /**
     * Resends a new OTP code to the user's email
     */
    async resendOtp(userId: string) {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) throw new UnauthorizedException('Utilisateur introuvable');
        if (user.emailVerified) return { success: true, message: 'Email déjà vérifié.' };

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        user.otpCode = otpCode;
        user.otpExpires = new Date(Date.now() + 30 * 60 * 1000);
        await this.userRepository.save(user);

        // Decrypt email to resend
        const email = this.decryptEmail(user.emailEncrypted);
        const citizen = await this.citizenRepository.findOne({ where: { user: { id: userId } } });
        try {
            await this.mailService.sendOtpEmail(email, otpCode, citizen?.pseudo || 'Citoyen');
        } catch (mailError) {
            this.logger.error(`Failed to resend OTP: ${mailError.message}`);
            throw new Error('Impossible d\'envoyer l\'email. Réessaye plus tard.');
        }

        return { success: true, message: 'Nouveau code envoyé !' };
    }

    /**
     * Login existing user
     */
    async loginUser(dto: LoginDto) {
        const trimmedPseudo = dto.pseudo.trim();
        // Find citizen by pseudo
        const citizen = await this.citizenRepository.findOne({
            where: { pseudo: trimmedPseudo },
            relations: ['user'],
        });

        if (!citizen) {
            throw new UnauthorizedException('Pseudo ou mot de passe incorrect');
        }

        // Verify password — supports both bcrypt and legacy SHA256
        const storedHash = citizen.user.passwordHash;
        let isValid = false;

        if (storedHash.startsWith('$2b$') || storedHash.startsWith('$2a$')) {
            // bcrypt hash
            isValid = await bcrypt.compare(dto.password, storedHash);
        } else {
            // Legacy SHA256 — migrate on success
            const sha256Hash = crypto.createHash('sha256').update(dto.password).digest('hex');
            isValid = (sha256Hash === storedHash);
            if (isValid) {
                // Auto-migrate to bcrypt
                citizen.user.passwordHash = await bcrypt.hash(dto.password, this.BCRYPT_ROUNDS);
                await this.userRepository.save(citizen.user);
                this.logger.log(`Migrated password to bcrypt for user ${citizen.pseudo}`);
            }
        }

        if (!isValid) {
            throw new UnauthorizedException('Pseudo ou mot de passe incorrect');
        }

        // === Gamification: Track daily connection ===
        await this.gamificationService.handleDailyConnection(citizen.id);
        await this.gamificationService.checkAnniversary(citizen.id);

        const accessToken = this.generateToken(citizen.user);

        return {
            success: true,
            userId: citizen.user.id,
            citizenId: citizen.id,
            pseudo: citizen.pseudo,
            email: this.decryptEmail(citizen.user.emailEncrypted),
            birthYear: citizen.birthYear,
            accessToken,
            message: 'Login successful',
        };
    }

    /**
     * Génère un jeton JWT pour un utilisateur.
     */
    private generateToken(user: User): string {
        const payload = { sub: user.id };
        return this.jwtService.sign(payload);
    }

    /**
     * Sends password reset email with a secure token
     */
    async forgotPassword(email: string) {
        const emailHash = this.hashEmail(email);
        const user = await this.userRepository.findOne({ where: { emailHash } });

        if (!user) {
            // Success response anyway to avoid account enumeration
            return {
                success: true,
                message: 'Si l\'email existe, un lien de réinitialisation a été envoyé.',
            };
        }

        // Generate token
        const token = crypto.randomBytes(32).toString('hex');
        user.resetToken = token;
        user.resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour
        await this.userRepository.save(user);

        // Fetch citizen for pseudo
        const citizen = await this.citizenRepository.findOne({ where: { user: { id: user.id } } });

        // Send email
        await this.mailService.sendPasswordResetEmail(email, token, citizen?.pseudo || 'Citoyen');

        return {
            success: true,
            message: 'Si l\'email existe, un lien de réinitialisation a été envoyé.',
        };
    }

    /**
     * Resets password using a valid token
     */
    async resetPassword(token: string, newPassword: string) {
        const user = await this.userRepository.findOne({
            where: { resetToken: token },
        });

        if (!user || !user.resetTokenExpires || user.resetTokenExpires < new Date()) {
            throw new UnauthorizedException('Lien de réinitialisation invalide ou expiré');
        }

        // Update password and clear token
        user.passwordHash = await this.hashPassword(newPassword);
        user.resetToken = null;
        user.resetTokenExpires = null;
        await this.userRepository.save(user);

        return {
            success: true,
            message: 'Votre mot de passe a été réinitialisé avec succès.',
        };
    }

    async checkPseudoAvailability(pseudo: string) {
        const trimmedPseudo = pseudo.trim();

        if (trimmedPseudo.length > 20 || trimmedPseudo.includes(' ')) {
            return { available: false, suggestions: [] };
        }

        const existingCitizen = await this.citizenRepository.findOne({
            where: { pseudo: trimmedPseudo },
            relations: ['user']
        });

        if (!existingCitizen || (existingCitizen.user && !existingCitizen.user.emailVerified)) {
            return { available: true };
        }

        // Generate 3 suggestions
        const suggestions = [
            `${trimmedPseudo}${new Date().getFullYear()}`,
            `${trimmedPseudo}_${Math.floor(100 + Math.random() * 899)}`,
            `${trimmedPseudo}_citoyen`,
        ];

        return {
            available: false,
            suggestions,
        };
    }

    private hashEmail(email: string): string {
        return crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');
    }

    /**
     * Chiffre un email avec AES-256-GCM.
     * Format stocké : iv:authTag:ciphertext (tout en hex)
     */
    public encryptEmail(email: string): string {
        const key = process.env.EMAIL_ENCRYPTION_KEY;
        if (!key || key.length < 32) {
            // Fallback Base64 si la clé n'est pas configurée (dev)
            return Buffer.from(email).toString('base64');
        }
        const keyBuffer = Buffer.from(key.substring(0, 32), 'utf-8');
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
        let encrypted = cipher.update(email, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag().toString('hex');
        return `${iv.toString('hex')}:${authTag}:${encrypted}`;
    }

    /**
     * Déchiffre un email stocké en AES-256-GCM.
     */
    public decryptEmail(emailEncrypted: string): string {
        const key = process.env.EMAIL_ENCRYPTION_KEY;
        if (!key || key.length < 32) {
            // Fallback Base64
            return Buffer.from(emailEncrypted, 'base64').toString('utf-8');
        }
        try {
            const [ivHex, authTagHex, ciphertext] = emailEncrypted.split(':');
            const keyBuffer = Buffer.from(key.substring(0, 32), 'utf-8');
            const iv = Buffer.from(ivHex, 'hex');
            const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
            decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
            let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        } catch {
            // If decryption fails, return empty (avoid leaking info)
            return '';
        }
    }

    /**
     * Hache un mot de passe avec bcrypt (12 rounds de salage).
     */
    private async hashPassword(password: string): Promise<string> {
        return bcrypt.hash(password, this.BCRYPT_ROUNDS);
    }
}
