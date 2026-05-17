import { Entity, Column, PrimaryGeneratedColumn, OneToOne, JoinColumn, ManyToOne } from 'typeorm';
import { User } from '../users/user.entity';
import { Constituency } from './constituency.entity';

/**
 * Profil citoyen attaché à un utilisateur (User).
 * Regroupe les infos de profilage (âge, circonscription) et la progression (gamification).
 */
@Entity()
export class Citizen {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @OneToOne(() => User)
    @JoinColumn()
    user: User;

    @Column({ unique: true })
    pseudo: string;

    @Column('int')
    birthYear: number;

    @Column({ nullable: true })
    postalCode: string;

    @Column({ nullable: true })
    constituencyId: string;

    @ManyToOne(() => Constituency)
    @JoinColumn({ name: 'constituencyId' })
    constituency: Constituency;


    // === Gamification Fields ===
    @Column({ default: 0 })
    xp: number; // Points d'expérience cumulés

    @Column({ default: 1 })
    currentLevel: number; // Niveau d'engagement (1 à 15)

    @Column({ type: 'timestamp', nullable: true })
    lastConnectionDate: Date; // Dernière connexion

    @Column({ default: 0 })
    consecutiveConnectionDays: number; // Jours de connexion consécutifs

    @Column({ default: 0 })
    totalVotes: number; // Nombre total de lois votées par ce citoyen

    @Column({ type: 'timestamp', nullable: true })
    lastWeeklyVoteDate: Date; // Dernier vote hebdomadaire

    @Column({ default: 0 })
    weeklyVoteStreak: number; // Semaines consécutives avec au moins 1 vote

    @Column('jsonb', { default: {} })
    achievedMilestones: Record<string, boolean>; // Milestones déjà atteints
}
