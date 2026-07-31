import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { TranscriptionJobStatus } from '../../enums/application.enums';
import { TranscriptionJob } from '../entities/transcription-job.entity';

@Injectable()
export class TranscriptionJobRepository {
    constructor(
        @InjectRepository(TranscriptionJob)
        private readonly repository: Repository<TranscriptionJob>,
    ) { }

    /**
     * Creates a new transcription job.
     * @param data - The data for the transcription job.
     * @returns The created transcription job.
     */
    async create(data: Partial<TranscriptionJob>): Promise<TranscriptionJob> {
        const entity = this.repository.create(data);
        return this.repository.save(entity);
    }

    /**
     * Finds a transcription job by ID.
     * @param id - The ID of the transcription job.
     * @returns The transcription job for the given ID.
     */
    async findById(id: string): Promise<TranscriptionJob | null> {
        return this.repository.findOne({ where: { id } });
    }

    /**
     * Finds transcription jobs by application ID.
     * @param applicationId - The ID of the application.
     * @returns The transcription jobs for the given application ID.
     */
    async findByApplicationId(
        applicationId: string,
    ): Promise<TranscriptionJob[]> {
        return this.repository.find({
            where: { applicationId },
            order: { createdAt: 'DESC' },
        });
    }

    /**
     * Finds the latest transcription job by application answer ID.
     * @param applicationAnswerId - The ID of the application answer.
     * @returns The latest transcription job for the given application answer ID.
     */
    async findLatestByApplicationAnswerId(
        applicationAnswerId: string,
    ): Promise<TranscriptionJob | null> {
        return this.repository.findOne({
            where: { applicationAnswerId },
            order: { createdAt: 'DESC' },
        });
    }

    /**
     * Checks if there is an active transcription job for a given application answer ID.
     * @param applicationAnswerId - The ID of the application answer.
     * @returns True if there is an active transcription job for the given application answer ID, false otherwise.
     */
    async hasActiveJobForAnswer(
        applicationAnswerId: string,
    ): Promise<boolean> {
        const count = await this.repository.count({
            where: {
                applicationAnswerId,
                status: In([
                    TranscriptionJobStatus.PENDING,
                    TranscriptionJobStatus.SENT,
                    TranscriptionJobStatus.COMPLETED,
                ]),
            },
        });
        return count > 0;
    }

    /**
     * Updates a transcription job.
     * @param id - The ID of the transcription job.
     * @param data - The data for the transcription job.
     * @returns The void.
     */
    async update(
        id: string,
        data: Partial<TranscriptionJob>,
    ): Promise<void> {
        await this.repository.update(id, {
            ...data,
            updatedAt: new Date(),
        } as Parameters<Repository<TranscriptionJob>['update']>[1]);
    }
}
