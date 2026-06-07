import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Deputy {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    externalId: string; // ID from NosDeputes.fr or AN

    /**
     * Référence interne AN (acteurRef), ex: "PA123456"
     * Utilisé pour matcher les votes dans les scrutins AN
     */
    @Column({ nullable: true, unique: true })
    anActeurRef: string;

    @Column()
    fullName: string;

    @Column({ nullable: true })
    lastName: string;

    @Column({ nullable: true })
    constituencyCode: string; // e.g., "75-01"

    @Column({ nullable: true })
    party: string; // Political party (short name)

    /**
     * Groupe politique à l'AN (ex: "RN", "LFI-NFP", "EPR")
     */
    @Column({ nullable: true })
    groupePolitique: string;

    @Column({ nullable: true })
    photoUrl: string;

    @Column('text', { nullable: true })
    bio: string;

    @Column({ nullable: true })
    department: string;

    @Column({ default: true })
    isActive: boolean;

    @Column({ default: 0 })
    presenceWeeks: number;

    @Column({ default: 0 })
    votesCount: number;
}
