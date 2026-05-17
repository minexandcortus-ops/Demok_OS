import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum ReportCategory {
    TITLE = 'TITLE',
    RESULT = 'RESULT',
    SUMMARY = 'SUMMARY',
    ARGUMENT = 'ARGUMENT',
    OTHER = 'OTHER',
}

export enum ReportStatus {
    PENDING = 'PENDING',
    REVIEWED = 'REVIEWED',
    RESOLVED = 'RESOLVED',
}

@Entity('reports')
export class Report {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar' })
    lawId: string;

    @Column({ type: 'varchar', nullable: true })
    userId: string;

    @Column({ type: 'enum', enum: ReportCategory })
    category: ReportCategory;

    @Column({ type: 'text' })
    description: string;

    @Column({ type: 'enum', enum: ReportStatus, default: ReportStatus.PENDING })
    status: ReportStatus;

    @CreateDateColumn()
    createdAt: Date;
}
