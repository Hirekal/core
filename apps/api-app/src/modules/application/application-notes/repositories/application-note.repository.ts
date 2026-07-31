import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApplicationNote } from '../entities/application-note.entity';

@Injectable()
export class ApplicationNoteRepository {
    constructor(
        @InjectRepository(ApplicationNote)
        private readonly repository: Repository<ApplicationNote>,
    ) { }

    /**
     * Creates a new application note.
     * @param data - The data for the application note.
     * @returns The created application note.
     */
    async create(data: {
        applicationId: string;
        authorId: string | null;
        text: string;
    }): Promise<ApplicationNote> {
        const note = this.repository.create(data);
        return this.repository.save(note);
    }

    /**
     * Finds all notes for a given application.
     * @param applicationId - The ID of the application.
     * @returns The notes for the application.
     */
    async findByApplicationId(
        applicationId: string,
    ): Promise<ApplicationNote[]> {
        return this.repository.find({
            where: { applicationId },
            order: { createdAt: 'DESC' },
        });
    }
}
