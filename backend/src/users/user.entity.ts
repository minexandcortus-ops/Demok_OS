import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity()
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    emailHash: string; // SHA-256 hash for lookup

    @Column('text')
    emailEncrypted: string; // AES encrypted

    @Column()
    passwordHash: string; // Argon2

    @Column({ default: false })
    emailVerified: boolean;

    @Column({ default: false })
    onboardingCompleted: boolean;

    @Column({ nullable: true })
    resetToken: string;

    @Column({ type: 'timestamp', nullable: true })
    resetTokenExpires: Date;

    @Column({ nullable: true })
    otpCode: string;

    @Column({ type: 'timestamp', nullable: true })
    otpExpires: Date;

    @Column({ nullable: true })
    fcmToken: string;

    @Column({ default: true })
    notifyLawResults: boolean;

    @Column({ default: true })
    notifySurveyResults: boolean;

    @Column({ default: true })
    notifyNewSurveys: boolean;

    @CreateDateColumn()
    createdAt: Date;
}
