import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('citizen_levels')
export class CitizenLevel {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ unique: true })
    level: number; // 1-15

    @Column()
    name: string; // "Observateur", "Citoyen Curieux", etc.

    @Column()
    badge: string; // Emoji du badge

    @Column()
    xpRequired: number; // XP minimum requis pour atteindre ce niveau
}
