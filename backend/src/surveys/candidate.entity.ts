import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Candidate {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column()
    party: string;

    @Column({ nullable: true })
    photoUrl: string;

    @Column({ nullable: true })
    partyLogoUrl: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ nullable: true })
    programUrl: string;

    @Column({ default: 0 })
    displayOrder: number; // For ordering candidates in the UI
}
