import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity';

/**
 * Jeton de rafraîchissement : seul son empreinte SHA-256 est stockée.
 * Rotation à chaque usage ; la réutilisation d'un jeton déjà tourné révoque toute la famille.
 */
@Entity()
export class RefreshToken {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE', eager: false })
    user: User;

    @Index({ unique: true })
    @Column({ length: 64 })
    tokenHash: string;

    @Column({ type: 'timestamp' })
    expiresAt: Date;

    @Column({ type: 'timestamp', nullable: true })
    revokedAt: Date | null;

    /** Jeton émis en remplacement lors de la rotation */
    @Column({ type: 'uuid', nullable: true })
    replacedById: string | null;

    @CreateDateColumn()
    createdAt: Date;
}
