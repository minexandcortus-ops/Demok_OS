import { Entity, PrimaryGeneratedColumn, Column, ManyToMany } from 'typeorm';
import { Law } from './law.entity';

@Entity('categories')
export class Category {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ unique: true })
    name: string;

    @Column({ unique: true })
    slug: string;

    @Column()
    color: string; // Code couleur hexadécimal (ex: #FFD700)

    @Column()
    icon: string; // Emoji (ex: 💰)

    @Column('text')
    keywords: string; // Mots-clés séparés par virgules pour la détection

    @ManyToMany(() => Law, law => law.categories)
    laws: Law[];
}
