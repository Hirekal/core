import type { Application } from '../../entities/application.entity';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';

@Entity('applicationNotes')
export class ApplicationNote {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'uuid' })
    applicationId!: string;

    @Column({ type: 'uuid', nullable: true })
    authorId!: string | null;

    @Column({ type: 'text' })
    text!: string;

    @Column({ type: 'timestamptz', default: () => 'now()' })
    createdAt!: Date;

    @Column({ type: 'timestamptz', default: () => 'now()' })
    updatedAt!: Date;

    @ManyToOne('Application', 'notes', { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'applicationId' })
    application!: Relation<Application>;
}
