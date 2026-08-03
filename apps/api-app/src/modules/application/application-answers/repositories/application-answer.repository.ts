import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApplicationAnswer } from '../entities/application-answer.entity';

@Injectable()
export class ApplicationAnswerRepository {
    constructor(
        @InjectRepository(ApplicationAnswer)
        private readonly repository: Repository<ApplicationAnswer>,
    ) { }

    /**
     * Upserts a text answer for a given application and question.
     * @param applicationId - The ID of the application.
     * @param questionId - The ID of the question.
     * @param answerText - The text answer.
     * @returns The upserted application answer.
     */
    async upsertText(
        applicationId: string,
        questionId: string,
        answerText: string | null,
    ): Promise<ApplicationAnswer> {
        const existing = await this.repository.findOne({
            where: { applicationId, questionId },
        });

        if (existing) {
            existing.answerText = answerText;
            existing.updatedAt = new Date();
            return this.repository.save(existing);
        }

        const created = this.repository.create({
            applicationId,
            questionId,
            answerText,
        });
        return this.repository.save(created);
    }

    /**
     * Upserts a video answer for a given application and question.
     * @param applicationId - The ID of the application.
     * @param questionId - The ID of the question.
     * @param data - The data for the video answer.
     * @returns The upserted application answer.
     */
    async upsertVideo(
        applicationId: string,
        questionId: string,
        data: {
            mediaType: string;
            mediaUrl: string;
            mediaStorageKey: string;
            mediaFileName: string;
            mediaDurationSeconds?: number | null;
            retakeCount?: number;
        },
    ): Promise<ApplicationAnswer> {
        const existing = await this.repository.findOne({
            where: { applicationId, questionId },
        });

        if (existing) {
            Object.assign(existing, data);
            existing.updatedAt = new Date();
            return this.repository.save(existing);
        }

        const created = this.repository.create({
            applicationId,
            questionId,
            retakeCount: data.retakeCount ?? 0,
            ...data,
        });
        return this.repository.save(created);
    }

    /**
     * Finds all answers for a given application.
     * @param applicationId - The ID of the application.
     * @returns The answers for the application.
     */
    async findByApplicationId(
        applicationId: string,
    ): Promise<ApplicationAnswer[]> {
        return this.repository.find({
            where: { applicationId },
            relations: { question: true },
        });
    }

    /**
     * Finds one answer for a given application and question.
     * @param applicationId - The ID of the application.
     * @param questionId - The ID of the question.
     * @returns The answer for the application and question.
     */
    async findOne(
        applicationId: string,
        questionId: string,
    ): Promise<ApplicationAnswer | null> {
        return this.repository.findOne({
            where: { applicationId, questionId },
        });
    }
}
