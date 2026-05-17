import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/**
 * A generic "topic poll" — a simple question with 3 options: pour, neutre, contre.
 * Votes are stored anonymously by user ID to prevent multiple votes.
 */
@Entity('topic_poll')
export class TopicPoll {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    slug: string; // ex: 'guerre-iran-2026'

    @Column()
    question: string; // ex: 'Êtes-vous pour une intervention militaire française en Iran ?'

    @Column({ nullable: true })
    description: string;

    @Column({ default: 0 })
    votePour: number;

    @Column({ default: 0 })
    voteNeutre: number;

    @Column({ default: 0 })
    voteContre: number;

    // Store user IDs who have voted (as a comma-separated list for simplicity)
    @Column({ type: 'text', default: '' })
    voters: string;

    @Column({ default: true })
    isActive: boolean;

    @CreateDateColumn()
    createdAt: Date;
}
