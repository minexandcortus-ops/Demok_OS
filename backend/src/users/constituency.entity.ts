import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Constituency {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    code: string; // e.g., "75-01" for Paris 1st

    @Column()
    name: string; // e.g., "Paris 1ère circonscription"

    @Column()
    department: string; // e.g., "75"

    @Column({ nullable: true })
    deputyName: string; // Current deputy

    @Column({ nullable: true })
    deputyEmail: string; // Email du député
}
