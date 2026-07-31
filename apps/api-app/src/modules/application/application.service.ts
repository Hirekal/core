import {
    BadRequestException,
    HttpException,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { JobRepository } from '../job/repositories/job.repository';
import { JobPipelineStageRepository } from '../job/job-pipeline-stages/repositories/job-pipeline-stage.repository';
import { JobQuestion } from '../job/job-questions/entities/job-question.entity';
import { JobApplicationField } from '../job/job-application-fields/entities/job-application-field.entity';
import { ApplicationPublicAccessService } from './application-public-access.service';
import { ApplicationErrors } from './constants/application-errors';
import {
    ListApplicationsQueryDto,
    StartApplicationDto,
    UpdateApplicationDto,
    UpdateApplicationRatingDto,
    UpdateApplicationStageDto,
} from './dto/application.dto';
import { Application } from './entities/application.entity';
import {
    ApplicationSortBy,
    ApplicationStatus,
    BUILT_IN_FIELD_KEYS,
    BuiltInFieldKey,
    JobAnalyticsEventType,
} from './enums/application.enums';
import {
    toApplicationDetail,
    toApplicationListItem,
    toPublicApplicationSession,
} from './application.mapper';
import { ApplicationFieldValueRepository } from './application-field-values/repositories/application-field-value.repository';
import { ApplicationStageHistoryRepository } from './application-stage-history/repositories/application-stage-history.repository';
import { JobAnalyticsEventRepository } from './job-analytics-events/repositories/job-analytics-event.repository';
import { ApplicationRepository } from './repositories/application.repository';
import { generateApplicationToken } from './utils/application-token.util';
import { TranscriptionJobsService } from './transcription-jobs/transcription-jobs.service';

@Injectable()
export class ApplicationService {
    private readonly logger = new Logger(ApplicationService.name);

    constructor(
        private readonly applicationRepository: ApplicationRepository,
        private readonly fieldValueRepository: ApplicationFieldValueRepository,
        private readonly stageHistoryRepository: ApplicationStageHistoryRepository,
        private readonly analyticsRepository: JobAnalyticsEventRepository,
        private readonly jobRepository: JobRepository,
        private readonly stageRepository: JobPipelineStageRepository,
        private readonly publicAccessService: ApplicationPublicAccessService,
        private readonly transcriptionJobsService: TranscriptionJobsService,
    ) { }

    /**
     * Starts an application by job slug.
     * @param slug - The slug of the job.
     * @param dto - The data for the start.
     * @returns The started application.
     */
    async startByJobSlug(
        slug: string,
        dto: StartApplicationDto,
    ): Promise<Record<string, unknown>> {
        try {
            const job = await this.jobRepository.findPublicBySlug(slug);
            if (!job) {
                throw new NotFoundException(ApplicationErrors.JOB_NOT_ACCEPTING);
            }

            const stages = await this.stageRepository.findByJobId(job.id, true);
            const defaultStage =
                stages.find((s) => s.slug === 'in-progress') ??
                stages.find((s) => s.isDefault) ??
                stages[0];

            const { token, hash } = generateApplicationToken();
            const now = new Date();

            const fields = dto.fields ?? {};
            const application = await this.applicationRepository.create({
                jobId: job.id,
                organizationId: job.organizationId,
                stageId: defaultStage?.id ?? null,
                firstName: fields.firstName?.trim() || null,
                lastName: fields.lastName?.trim() || null,
                email: fields.email?.trim() || null,
                phone: fields.phone?.trim() || null,
                status: ApplicationStatus.IN_PROGRESS,
                sessionTokenHash: hash,
                startedAt: now,
                lastActivityAt: now,
                submittedAt: null,
                rating: null,
            });

            await this.saveCustomFieldValues(
                application.id,
                job.applicationFields ?? [],
                fields.custom ?? {},
            );

            await this.applicationRepository.incrementJobCounters(
                job.id,
                'applicationsStarted',
            );
            await this.analyticsRepository.record(
                job.id,
                JobAnalyticsEventType.APPLICATION_STARTED,
                dto.sessionId,
            );

            return toPublicApplicationSession(application, token);
        } catch (error) {
            if (error instanceof HttpException) throw error;
            this.logger.error(
                `startByJobSlug failed slug=${slug}: ${(error as Error).message}`,
            );
            throw new InternalServerErrorException(
                ApplicationErrors.FAILED_TO_START,
            );
        }
    }

    /**
     * Updates a public application.
     * @param id - The ID of the application.
     * @param token - The token of the application.
     * @param dto - The data for the update.
     * @returns The updated application.
     */
    async updatePublic(
        id: string,
        token: string,
        dto: UpdateApplicationDto,
    ): Promise<Record<string, unknown>> {
        try {
            const application = await this.publicAccessService.assertPublicAccess(
                id,
                token,
            );

            const updates: Partial<Application> = {
                lastActivityAt: new Date(),
            };

            if (dto.firstName !== undefined) {
                updates.firstName = dto.firstName.trim() || null;
            }
            if (dto.lastName !== undefined) {
                updates.lastName = dto.lastName.trim() || null;
            }
            if (dto.email !== undefined) {
                updates.email = dto.email.trim() || null;
            }
            if (dto.phone !== undefined) {
                updates.phone = dto.phone.trim() || null;
            }

            await this.applicationRepository.update(id, updates);

            if (dto.custom) {
                const job = application.job;
                await this.saveCustomFieldValues(
                    id,
                    job.applicationFields ?? [],
                    dto.custom,
                );
            }

            return { id, updated: true };
        } catch (error) {
            if (error instanceof HttpException) throw error;
            this.logger.error(
                `updatePublic failed id=${id}: ${(error as Error).message}`,
            );
            throw new InternalServerErrorException(
                ApplicationErrors.FAILED_TO_UPDATE,
            );
        }
    }

    /**
     * Submits a public application.
     * @param id - The ID of the application.
     * @param token - The token of the application.
     * @returns The submitted application.
     */
    async submitPublic(
        id: string,
        token: string,
    ): Promise<Record<string, unknown>> {
        try {
            const application = await this.publicAccessService.assertPublicAccess(
                id,
                token,
            );
            const job = application.job;

            this.validateRequiredForSubmit(
                application,
                job.applicationFields ?? [],
                job.questions ?? [],
            );

            const stages = await this.stageRepository.findByJobId(job.id, true);
            const reviewedStage = stages.find(
                (s) => s.slug === 'to-be-reviewed',
            );
            const nextStageId = reviewedStage?.id ?? application.stageId;

            const submittedAt = new Date();
            await this.applicationRepository.update(id, {
                status: ApplicationStatus.SUBMITTED,
                submittedAt,
                lastActivityAt: submittedAt,
                stageId: nextStageId,
                sessionTokenHash: null,
            });

            if (nextStageId && nextStageId !== application.stageId) {
                await this.stageHistoryRepository.record({
                    applicationId: id,
                    fromStageId: application.stageId,
                    toStageId: nextStageId,
                    changedById: null,
                });
            }

            await this.applicationRepository.incrementJobCounters(
                job.id,
                'applicationsSubmitted',
            );
            await this.applicationRepository.incrementJobCounters(
                job.id,
                'applicationCount',
            );
            await this.analyticsRepository.record(
                job.id,
                JobAnalyticsEventType.APPLICATION_SUBMITTED,
            );

            this.scheduleTranscription(application, job);

            return { id, status: ApplicationStatus.SUBMITTED, submittedAt };
        } catch (error) {
            if (error instanceof HttpException) throw error;
            this.logger.error(
                `submitPublic failed id=${id}: ${(error as Error).message}`,
            );
            throw new InternalServerErrorException(
                ApplicationErrors.FAILED_TO_SUBMIT,
            );
        }
    }

    /**
     * Lists applications for a given job.
     * @param jobId - The ID of the job.
     * @param organizationId - The ID of the organization.
     * @param query - The query for the list.
     * @returns The applications for the given job.
     */
    async listForJob(
        jobId: string,
        organizationId: string,
        query: ListApplicationsQueryDto,
    ): Promise<Record<string, unknown>[]> {
        try {
            await this.assertJobAccess(jobId, organizationId);
            const sortBy = this.parseSortBy(query.sortBy);
            const items = await this.applicationRepository.listForJob({
                jobId,
                organizationId,
                stageId: query.stageId,
                search: query.search,
                sortBy,
            });
            return items.map(toApplicationListItem);
        } catch (error) {
            if (error instanceof HttpException) throw error;
            this.logger.error(
                `listForJob failed jobId=${jobId}: ${(error as Error).message}`,
            );
            throw new InternalServerErrorException(
                ApplicationErrors.FAILED_TO_LIST,
            );
        }
    }

    /**
     * Finds an application by ID for a given organization.
     * @param id - The ID of the application.
     * @param organizationId - The ID of the organization.
     * @returns The application for the given ID and organization.
     */
    async findByIdForOrg(
        id: string,
        organizationId: string,
    ): Promise<Record<string, unknown>> {
        try {
            const application =
                await this.applicationRepository.findByIdForOrg(
                    id,
                    organizationId,
                );
            if (!application) {
                throw new NotFoundException(ApplicationErrors.NOT_FOUND(id));
            }

            const job = await this.jobRepository.findByIdForOrg(
                application.jobId,
                organizationId,
            );

            const transcriptionJobs =
                await this.transcriptionJobsService.findByApplicationId(id);
            const transcriptionByAnswerId = new Map(
                transcriptionJobs.map((item) => [item.applicationAnswerId, item]),
            );

            return toApplicationDetail(
                application,
                job?.questions ?? [],
                transcriptionByAnswerId,
            );
        } catch (error) {
            if (error instanceof HttpException) throw error;
            this.logger.error(
                `findByIdForOrg failed id=${id}: ${(error as Error).message}`,
            );
            throw new InternalServerErrorException(
                ApplicationErrors.FAILED_TO_GET,
            );
        }
    }

    /**
     * Updates the stage of a given application.
     * @param id - The ID of the application.
     * @param organizationId - The ID of the organization.
     * @param userId - The ID of the user.
     * @param dto - The data for the update.
     * @returns The updated application.
     */
    async updateStage(
        id: string,
        organizationId: string,
        userId: string,
        dto: UpdateApplicationStageDto,
    ): Promise<Record<string, unknown>> {
        try {
            const application =
                await this.applicationRepository.findByIdForOrg(
                    id,
                    organizationId,
                );
            if (!application) {
                throw new NotFoundException(ApplicationErrors.NOT_FOUND(id));
            }

            const stages = await this.stageRepository.findByJobId(
                application.jobId,
                true,
            );
            const target = stages.find((s) => s.id === dto.stageId);
            if (!target) {
                throw new BadRequestException(ApplicationErrors.INVALID_STAGE);
            }

            const fromStageId = application.stageId;
            await this.applicationRepository.update(id, {
                stageId: dto.stageId,
                lastActivityAt: new Date(),
            });
            await this.stageHistoryRepository.record({
                applicationId: id,
                fromStageId,
                toStageId: dto.stageId,
                changedById: userId,
            });

            return { id, stageId: dto.stageId, fromStageId };
        } catch (error) {
            if (error instanceof HttpException) throw error;
            this.logger.error(
                `updateStage failed id=${id}: ${(error as Error).message}`,
            );
            throw new InternalServerErrorException(
                ApplicationErrors.FAILED_TO_UPDATE_STAGE,
            );
        }
    }

    /**
     * Updates the rating of a given application.
     * @param id - The ID of the application.
     * @param organizationId - The ID of the organization.
     * @param dto - The data for the update.
     * @returns The updated application.
     */
    async updateRating(
        id: string,
        organizationId: string,
        dto: UpdateApplicationRatingDto,
    ): Promise<Record<string, unknown>> {
        try {
            const application =
                await this.applicationRepository.findByIdForOrg(
                    id,
                    organizationId,
                );
            if (!application) {
                throw new NotFoundException(ApplicationErrors.NOT_FOUND(id));
            }

            if (
                dto.rating !== null &&
                (dto.rating < 1 || dto.rating > 5 || !Number.isInteger(dto.rating))
            ) {
                throw new BadRequestException(ApplicationErrors.INVALID_RATING);
            }

            await this.applicationRepository.update(id, {
                rating: dto.rating,
                lastActivityAt: new Date(),
            });

            return { id, rating: dto.rating };
        } catch (error) {
            if (error instanceof HttpException) throw error;
            this.logger.error(
                `updateRating failed id=${id}: ${(error as Error).message}`,
            );
            throw new InternalServerErrorException(
                ApplicationErrors.FAILED_TO_UPDATE_RATING,
            );
        }
    }

    /**
     * Soft deletes a given application.
     * @param id - The ID of the application.
     * @param organizationId - The ID of the organization.
     * @returns The void.
     */
    async softDelete(id: string, organizationId: string): Promise<void> {
        try {
            const application =
                await this.applicationRepository.findByIdForOrg(
                    id,
                    organizationId,
                );
            if (!application) {
                throw new NotFoundException(ApplicationErrors.NOT_FOUND(id));
            }
            await this.applicationRepository.softDelete(id);
        } catch (error) {
            if (error instanceof HttpException) throw error;
            this.logger.error(
                `softDelete failed id=${id}: ${(error as Error).message}`,
            );
            throw new InternalServerErrorException(
                ApplicationErrors.FAILED_TO_DELETE,
            );
        }
    }

    /**
     * Assesses job access for a given job and organization.
     * @param jobId - The ID of the job.
     * @param organizationId - The ID of the organization.
     * @returns The void.
     */
    private async assertJobAccess(
        jobId: string,
        organizationId: string,
    ): Promise<void> {
        const job = await this.jobRepository.findByIdForOrg(
            jobId,
            organizationId,
        );
        if (!job) {
            throw new NotFoundException(`Job ${jobId} not found`);
        }
    }

    /**
     * Saves custom field values for a given application.
     * @param applicationId - The ID of the application.
     * @param fields - The fields to save.
     * @param custom - The custom values to save.
     * @returns The void.
     */
    private async saveCustomFieldValues(
        applicationId: string,
        fields: JobApplicationField[],
        custom: Record<string, string>,
    ): Promise<void> {
        for (const [fieldId, rawValue] of Object.entries(custom)) {
            const field = fields.find((f) => f.id === fieldId);
            if (!field || field.builtIn) {
                throw new BadRequestException(ApplicationErrors.INVALID_FIELD);
            }
            await this.fieldValueRepository.upsert(
                applicationId,
                fieldId,
                rawValue?.trim() ?? null,
            );
        }
    }

    /**
     * Validates required fields and answers for a given application.
     * @param application - The application to validate.
     * @param fields - The fields to validate.
     * @param questions - The questions to validate.
     * @returns The void.
     */
    private validateRequiredForSubmit(
        application: Application,
        fields: JobApplicationField[],
        questions: JobQuestion[],
    ): void {
        for (const field of fields) {
            if (!field.required) continue;

            if (field.builtIn && field.fieldKey) {
                const key = field.fieldKey as BuiltInFieldKey;
                if (!BUILT_IN_FIELD_KEYS.includes(key)) continue;
                const value = application[key];
                if (!value?.trim()) {
                    throw new BadRequestException(
                        ApplicationErrors.MISSING_REQUIRED_FIELDS,
                    );
                }
                continue;
            }

            const stored = application.fieldValues?.find(
                (fv) => fv.applicationFieldId === field.id,
            );
            if (!stored?.value?.trim()) {
                throw new BadRequestException(
                    ApplicationErrors.MISSING_REQUIRED_FIELDS,
                );
            }
        }

        const answers = application.answers ?? [];
        for (const question of questions) {
            if (!question.required) continue;

            const answer = answers.find((a) => a.questionId === question.id);
            if (this.publicAccessService.isMediaQuestion(question)) {
                if (!answer?.mediaStorageKey && !answer?.mediaUrl) {
                    throw new BadRequestException(
                        ApplicationErrors.MISSING_VIDEO_ANSWER,
                    );
                }
                continue;
            }

            if (!answer?.answerText?.trim()) {
                throw new BadRequestException(
                    ApplicationErrors.MISSING_REQUIRED_ANSWERS,
                );
            }
        }
    }

    /**
     * Starts AI transcription in the background after a successful submit.
     */
    private scheduleTranscription(
        application: Application,
        job: NonNullable<Application['job']>,
    ): void {
        void this.transcriptionJobsService
            .enqueueAfterSubmit({
                applicationId: application.id,
                jobId: job.id,
                organizationId: application.organizationId,
                aiTranscripts: job.aiTranscripts,
                transcriptionLanguage: job.transcriptionLanguage,
                questions: job.questions ?? [],
            })
            .catch((error) => {
                this.logger.error(
                    `Transcription enqueue failed applicationId=${application.id}: ${(error as Error).message}`,
                );
            });
    }

    /**
     * Parses a sort by value into an ApplicationSortBy enum.
     * @param value - The value to parse.
     * @returns The ApplicationSortBy enum value.
     */
    private parseSortBy(value?: string): ApplicationSortBy {
        switch (value) {
            case ApplicationSortBy.NAME:
            case 'name':
                return ApplicationSortBy.NAME;
            case ApplicationSortBy.STAGE:
            case 'stage':
                return ApplicationSortBy.STAGE;
            default:
                return ApplicationSortBy.SUBMITTED;
        }
    }
}
