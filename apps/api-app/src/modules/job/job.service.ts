import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { DataSource, DeepPartial } from 'typeorm';
import {
  BUILT_IN_VIDEO_QUESTION,
  DEFAULT_APPLICATION_FIELDS,
  isBuiltInApplicationFieldKey,
  isMediaQuestionType,
  DEFAULT_EMAIL_AUTOMATION,
  DEFAULT_GENERAL_SETTINGS,
  DEFAULT_PIPELINE_STAGES,
  DEFAULT_THANK_YOU_PAGE,
  DEFAULT_WEBHOOK_SETTINGS,
} from './constants/job-defaults';
import { JobErrors } from './constants/job-errors';
import {
  ApplicationFieldType,
  EmploymentType,
  JobStatus,
  QuestionCategory,
  QuestionRetakes,
  QuestionType,
} from './enums/job.enums';
import { R2Service } from '../cloud-storage/r2.service';
import { isPostgresUniqueViolation } from '../../common/utils/error.util';
import {
  buildMediaKey,
  assertMediaKeyScope,
  validateMediaFile,
} from './utils/media.util';
import { PresignUploadDto } from '../cloud-storage/dto/presign-upload.dto';
import { ConfirmUploadDto } from '../cloud-storage/dto/confirm-upload.dto';
import { resolveUniqueSlug, slugifyTitle } from '../../common/utils/slug.util';
import { JobApplicationFieldRepository } from './job-application-fields/repositories/job-application-field.repository';
import { JobPipelineStageRepository } from './job-pipeline-stages/repositories/job-pipeline-stage.repository';
import { JobQuestionRepository } from './job-questions/repositories/job-question.repository';
import { JobSettingsRepository } from './job-settings/repositories/job-settings.repository';
import { JobApplicationField } from './job-application-fields/entities/job-application-field.entity';
import { JobPipelineStage } from './job-pipeline-stages/entities/job-pipeline-stage.entity';
import { JobQuestion } from './job-questions/entities/job-question.entity';
import { JobSettings } from './job-settings/entities/job-settings.entity';
import { CreateJobDto } from './dto/create-job.dto';
import { ListJobsQueryDto } from './dto/list-jobs-query.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { Job } from './entities/job.entity';
import { toJobResponse, toPublicJobResponse } from './job.mapper';
import { JobRepository } from './repositories/job.repository';

@Injectable()
export class JobService {
  private readonly logger = new Logger(JobService.name);

  constructor(
    private readonly jobRepository: JobRepository,
    private readonly questionRepository: JobQuestionRepository,
    private readonly fieldRepository: JobApplicationFieldRepository,
    private readonly stageRepository: JobPipelineStageRepository,
    private readonly settingsRepository: JobSettingsRepository,
    private readonly r2Service: R2Service,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * List org-scoped jobs with filters and pagination.
   * @param organizationId
   * @param query
   * @returns
   */
  async findAll(
    organizationId: string,
    query: ListJobsQueryDto,
  ): Promise<{
    items: Record<string, unknown>[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const page = query.page ?? 1;
      const limit = query.limit ?? 20;
      const { items, total } = await this.jobRepository.findByOrganization({
        organizationId,
        status: query.status,
        search: query.search,
        sortBy: query.sortBy,
        order: query.order,
        page,
        limit,
      });

      return {
        items: items.map((job) => toJobResponse(job, this.configService)),
        total,
        page,
        limit,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `findAll failed organizationId=${organizationId}: ${(error as Error).message}`,
      );
      throw new InternalServerErrorException(JobErrors.FAILED_TO_LIST);
    }
  }

  /**
   * Get a full job by id scoped to organization.
   * @param id
   * @param organizationId
   * @returns
   */
  async findById(
    id: string,
    organizationId: string,
  ): Promise<Record<string, unknown>> {
    try {
      const job = await this.jobRepository.findByIdForOrg(id, organizationId);
      if (!job) {
        throw new NotFoundException(JobErrors.NOT_FOUND(id));
      }
      return toJobResponse(job, this.configService);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `findById failed id=${id} organizationId=${organizationId}: ${(error as Error).message}`,
      );
      throw new InternalServerErrorException(JobErrors.FAILED_TO_GET);
    }
  }

  /**
   * Create a job and seed questions, fields, stages, and settings in one transaction.
   * Retries on slug UNIQUE collisions (TOCTOU between isSlugTaken and insert).
   */
  async create(
    organizationId: string,
    userId: string,
    dto: CreateJobDto,
  ): Promise<Record<string, unknown>> {
    const maxSlugAttempts = 5;

    try {
      const timestamp = new Date();
      const baseSlug = slugifyTitle(dto.title);

      for (let attempt = 1; attempt <= maxSlugAttempts; attempt++) {
        const slug = await resolveUniqueSlug(baseSlug, (s) =>
          this.jobRepository.isSlugTaken(s),
        );

        try {
          const jobId = await this.dataSource.transaction(async (manager) => {
            const jobRepo = manager.getRepository(Job);

            const job = jobRepo.create({
              organizationId,
              createdById: userId,
              updatedById: userId,
              title: dto.title,
              internalTitle: dto.internalTitle ?? null,
              company: dto.company,
              companyWebsite: dto.companyWebsite ?? null,
              location: dto.location ?? null,
              employmentType: dto.employmentType ?? EmploymentType.FULL_TIME,
              status: dto.status ?? JobStatus.ACTIVE,
              slug,
              candidateIntroTitle: dto.candidateIntroTitle ?? null,
              candidateInstructions: dto.candidateInstructions ?? null,
              applicationSectionTitle:
                dto.applicationSectionTitle ?? 'Complete your application',
              applyButtonLabel: dto.applyButtonLabel?.trim() || 'Start now',
              introMediaType: dto.introMedia?.type ?? null,
              introMediaUrl: dto.introMedia?.url ?? null,
              introMediaStorageKey: dto.introMedia?.storageKey ?? null,
              introMediaFileName: dto.introMedia?.fileName ?? null,
              questionRetakes: dto.questionRetakes ?? QuestionRetakes.UNLIMITED,
              transcriptionLanguage: dto.transcriptionLanguage ?? 'english',
              aiTranscripts: dto.aiTranscripts ?? true,
              visitorCount: 0,
              viewers: 0,
              applicationsStarted: 0,
              applicationsSubmitted: 0,
              applicationCount: 0,
              createdAt: timestamp,
              updatedAt: timestamp,
              deletedAt: null,
            });

            const savedJob = await jobRepo.save(job);
            const questionRepo = manager.getRepository(JobQuestion);
            const fieldRepo = manager.getRepository(JobApplicationField);
            const stageRepo = manager.getRepository(JobPipelineStage);
            const settingsRepo = manager.getRepository(JobSettings);

            let sortOrder = 1;
            const questionsToSave: DeepPartial<JobQuestion>[] = [];
            let builtInVideoLabel = BUILT_IN_VIDEO_QUESTION.label;

            if (dto.questions?.length) {
              for (const q of dto.questions) {
                if (isMediaQuestionType(q.type)) {
                  if (q.label?.trim()) {
                    builtInVideoLabel = q.label.trim();
                  }
                  continue;
                }

                questionsToSave.push({
                  jobId: savedJob.id,
                  sortOrder: q.sortOrder ?? sortOrder++,
                  label: q.label,
                  type: q.type,
                  category: q.category ?? QuestionCategory.STANDARD,
                  required: q.required ?? false,
                  builtIn: false,
                  options: q.options ?? null,
                  createdAt: timestamp,
                  updatedAt: timestamp,
                });
              }
            }

            questionsToSave.push({
              jobId: savedJob.id,
              sortOrder,
              label: builtInVideoLabel,
              type: QuestionType.VIDEO,
              category: QuestionCategory.MEDIA,
              required: BUILT_IN_VIDEO_QUESTION.required,
              builtIn: true,
              options: null,
              createdAt: timestamp,
              updatedAt: timestamp,
            });
            await questionRepo.save(questionsToSave);

            const fieldsToSave: DeepPartial<JobApplicationField>[] = [
              ...DEFAULT_APPLICATION_FIELDS.map((field) => ({
                jobId: savedJob.id,
                sortOrder: field.sortOrder,
                label: field.label,
                type: field.type as ApplicationFieldType,
                required: field.required,
                builtIn: field.builtIn,
                fieldKey: field.fieldKey,
                createdAt: timestamp,
                updatedAt: timestamp,
              })),
            ];

            if (dto.applicationFields?.length) {
              let customOrder = DEFAULT_APPLICATION_FIELDS.length + 1;
              for (const f of dto.applicationFields) {
                if (isBuiltInApplicationFieldKey(f.fieldKey)) {
                  const seeded = fieldsToSave.find(
                    (row) => row.fieldKey === f.fieldKey,
                  );
                  if (seeded) {
                    seeded.label = f.label ?? seeded.label;
                    seeded.required = f.required ?? seeded.required;
                    if (f.sortOrder != null) {
                      seeded.sortOrder = f.sortOrder;
                    }
                  }
                  continue;
                }

                fieldsToSave.push({
                  jobId: savedJob.id,
                  sortOrder: f.sortOrder ?? customOrder++,
                  label: f.label,
                  type: f.type,
                  required: f.required ?? false,
                  builtIn: false,
                  fieldKey: f.fieldKey ?? null,
                  createdAt: timestamp,
                  updatedAt: timestamp,
                });
              }
            }
            await fieldRepo.save(fieldsToSave);

            await stageRepo.save(
              DEFAULT_PIPELINE_STAGES.map((stage) => ({
                jobId: savedJob.id,
                name: stage.name,
                slug: stage.slug,
                sortOrder: stage.sortOrder,
                active: stage.active,
                isDefault: stage.isDefault,
                createdAt: timestamp,
                updatedAt: timestamp,
              })),
            );

            await settingsRepo.save({
              jobId: savedJob.id,
              general: { ...DEFAULT_GENERAL_SETTINGS },
              thankYouPage: { ...DEFAULT_THANK_YOU_PAGE },
              emailAutomation: { ...DEFAULT_EMAIL_AUTOMATION },
              webhook: { ...DEFAULT_WEBHOOK_SETTINGS },
              createdAt: timestamp,
              updatedAt: timestamp,
            });

            return savedJob.id;
          });

          return this.findById(jobId, organizationId);
        } catch (error) {
          if (isPostgresUniqueViolation(error)) {
            if (attempt < maxSlugAttempts) {
              this.logger.warn(
                `create slug collision attempt=${attempt} slug=${slug}; retrying`,
              );
              continue;
            }
            throw new ConflictException(JobErrors.SLUG_CONFLICT);
          }
          throw error;
        }
      }

      throw new ConflictException(JobErrors.SLUG_CONFLICT);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `create failed organizationId=${organizationId}: ${(error as Error).message}`,
      );
      throw new InternalServerErrorException(JobErrors.FAILED_TO_CREATE);
    }
  }

  /**
   * Update core job fields and optionally nested questions/fields.
   * @param id
   * @param organizationId
   * @param userId
   * @param dto
   * @returns
   */
  async update(
    id: string,
    organizationId: string,
    userId: string,
    dto: UpdateJobDto,
  ): Promise<Record<string, unknown>> {
    try {
      const existing = await this.jobRepository.findByIdForOrg(
        id,
        organizationId,
      );
      if (!existing) {
        throw new NotFoundException(JobErrors.NOT_FOUND(id));
      }

      const timestamp = new Date();
      const updateData: Partial<Job> = {
        updatedById: userId,
        updatedAt: timestamp,
      };

      if (dto.title !== undefined) updateData.title = dto.title;
      if (dto.internalTitle !== undefined)
        updateData.internalTitle = dto.internalTitle;
      if (dto.company !== undefined) updateData.company = dto.company;
      if (dto.companyWebsite !== undefined)
        updateData.companyWebsite = dto.companyWebsite;
      if (dto.location !== undefined) updateData.location = dto.location;
      if (dto.employmentType !== undefined)
        updateData.employmentType = dto.employmentType;
      if (dto.status !== undefined) updateData.status = dto.status;
      if (dto.candidateIntroTitle !== undefined)
        updateData.candidateIntroTitle = dto.candidateIntroTitle;
      if (dto.candidateInstructions !== undefined)
        updateData.candidateInstructions = dto.candidateInstructions;
      if (dto.applicationSectionTitle !== undefined)
        updateData.applicationSectionTitle = dto.applicationSectionTitle;
      if (dto.applyButtonLabel !== undefined)
        updateData.applyButtonLabel =
          dto.applyButtonLabel.trim() || 'Start now';
      if (dto.questionRetakes !== undefined)
        updateData.questionRetakes = dto.questionRetakes;
      if (dto.transcriptionLanguage !== undefined)
        updateData.transcriptionLanguage = dto.transcriptionLanguage;
      if (dto.aiTranscripts !== undefined)
        updateData.aiTranscripts = dto.aiTranscripts;

      // Collect old R2 keys to delete ONLY after DB transaction commits successfully
      const r2KeysToDeleteAfterCommit: string[] = [];

      if (dto.introMedia !== undefined) {
        if (dto.introMedia === null) {
          if (existing.introMediaStorageKey) {
            r2KeysToDeleteAfterCommit.push(existing.introMediaStorageKey);
          }
          updateData.introMediaType = null;
          updateData.introMediaUrl = null;
          updateData.introMediaStorageKey = null;
          updateData.introMediaFileName = null;
        } else {
          if (
            dto.introMedia.storageKey &&
            dto.introMedia.storageKey !== existing.introMediaStorageKey &&
            existing.introMediaStorageKey
          ) {
            r2KeysToDeleteAfterCommit.push(existing.introMediaStorageKey);
          }
          updateData.introMediaType = dto.introMedia.type ?? null;
          updateData.introMediaUrl = dto.introMedia.url ?? null;
          updateData.introMediaStorageKey = dto.introMedia.storageKey ?? null;
          updateData.introMediaFileName = dto.introMedia.fileName ?? null;
        }
      }

      await this.dataSource.transaction(async (manager) => {
        await manager.getRepository(Job).update(id, updateData as never);

        if (dto.questions) {
          await this.syncQuestions(manager, id, dto.questions, timestamp);
        }

        if (dto.applicationFields) {
          await this.syncApplicationFields(
            manager,
            id,
            dto.applicationFields,
            timestamp,
          );
        }
      });

      // Best-effort R2 cleanup after successful commit (never roll back DB for R2 failures)
      for (const key of r2KeysToDeleteAfterCommit) {
        try {
          await this.r2Service.delete(key);
        } catch (r2Error) {
          this.logger.warn(
            `Failed to delete old intro media key=${key} after job update ${id}: ${(r2Error as Error).message}`,
          );
        }
      }

      return this.findById(id, organizationId);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`update failed id=${id}: ${(error as Error).message}`);
      throw new InternalServerErrorException(JobErrors.FAILED_TO_UPDATE);
    }
  }

  /**
   * Soft-delete an archived job and best-effort R2 cleanup.
   * @param id
   * @param organizationId
   * @param userId
   * @returns
   */
  async delete(
    id: string,
    organizationId: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    try {
      const job = await this.jobRepository.findByIdForOrg(id, organizationId);
      if (!job) {
        throw new NotFoundException(JobErrors.NOT_FOUND(id));
      }

      if (job.status !== JobStatus.ARCHIVED) {
        throw new BadRequestException(JobErrors.ONLY_ARCHIVED_CAN_DELETE);
      }

      await this.jobRepository.update(id, {
        deletedAt: new Date(),
        updatedById: userId,
        updatedAt: new Date(),
      });

      // Soft-delete already succeeded — R2 cleanup must not fail the API response
      await this.cleanupJobMedia(job);

      return { success: true };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`delete failed id=${id}: ${(error as Error).message}`);
      throw new InternalServerErrorException(JobErrors.FAILED_TO_DELETE);
    }
  }

  /**
   * Duplicate a job with children and R2 media copy.
   *
   * R2 copies happen OUTSIDE the DB transaction to avoid holding Postgres
   * connections open during network I/O. If the DB write fails after copies,
   * newly copied R2 keys are cleaned up best-effort.
   * Slug UNIQUE collisions retry without re-copying R2.
   */
  async duplicate(
    id: string,
    organizationId: string,
    userId: string,
  ): Promise<Record<string, unknown>> {
    const copiedR2Keys: string[] = [];
    const maxSlugAttempts = 5;

    try {
      const original = await this.jobRepository.findByIdForOrg(
        id,
        organizationId,
      );
      if (!original) {
        throw new NotFoundException(JobErrors.NOT_FOUND(id));
      }

      const timestamp = new Date();
      const baseSlug = slugifyTitle(`${original.title}-copy`);
      const newJobId = randomUUID();

      // --- R2 copies first (outside DB transaction) ---
      const introMediaType = original.introMediaType;
      let introMediaStorageKey: string | null = null;
      let introMediaUrl: string | null = null;
      const introMediaFileName = original.introMediaFileName;

      if (original.introMediaStorageKey) {
        introMediaStorageKey = buildMediaKey(
          organizationId,
          newJobId,
          'intro',
          original.introMediaFileName ?? 'intro',
        );
        await this.r2Service.copy(
          original.introMediaStorageKey,
          introMediaStorageKey,
        );
        copiedR2Keys.push(introMediaStorageKey);
        introMediaUrl = this.r2Service.getPublicUrl(introMediaStorageKey);
      }

      const general = original.settings
        ? structuredClone(original.settings.general)
        : structuredClone(DEFAULT_GENERAL_SETTINGS);
      const thankYouPage = original.settings
        ? structuredClone(original.settings.thankYouPage)
        : structuredClone(DEFAULT_THANK_YOU_PAGE);

      if (thankYouPage.storageKey) {
        const newKey = buildMediaKey(
          organizationId,
          newJobId,
          'thank-you',
          thankYouPage.fileName || 'thank-you',
        );
        await this.r2Service.copy(thankYouPage.storageKey, newKey);
        copiedR2Keys.push(newKey);
        thankYouPage.storageKey = newKey;
        thankYouPage.mediaUrl = this.r2Service.getPublicUrl(newKey);
      }

      if (general.socialPreview?.previewImage?.storageKey) {
        const preview = general.socialPreview.previewImage;
        const newKey = buildMediaKey(
          organizationId,
          newJobId,
          'social-preview',
          preview.fileName || 'preview',
        );
        await this.r2Service.copy(preview.storageKey, newKey);
        copiedR2Keys.push(newKey);
        preview.storageKey = newKey;
        preview.url = this.r2Service.getPublicUrl(newKey);
      }

      // --- DB writes only (no R2 network I/O inside the transaction) ---
      for (let attempt = 1; attempt <= maxSlugAttempts; attempt++) {
        const slug = await resolveUniqueSlug(baseSlug, (s) =>
          this.jobRepository.isSlugTaken(s),
        );

        try {
          await this.dataSource.transaction(async (manager) => {
            const jobRepo = manager.getRepository(Job);
            const questionRepo = manager.getRepository(JobQuestion);
            const fieldRepo = manager.getRepository(JobApplicationField);
            const stageRepo = manager.getRepository(JobPipelineStage);
            const settingsRepo = manager.getRepository(JobSettings);

            await jobRepo.save(
              jobRepo.create({
                id: newJobId,
                organizationId,
                createdById: userId,
                updatedById: userId,
                title: `${original.title} (Copy)`,
                internalTitle: original.internalTitle,
                company: original.company,
                companyWebsite: original.companyWebsite,
                location: original.location,
                employmentType: original.employmentType,
                status: JobStatus.ACTIVE,
                slug,
                candidateIntroTitle: original.candidateIntroTitle,
                candidateInstructions: original.candidateInstructions,
                applicationSectionTitle: original.applicationSectionTitle,
                applyButtonLabel: original.applyButtonLabel,
                introMediaType: introMediaStorageKey ? introMediaType : null,
                introMediaStorageKey,
                introMediaUrl,
                introMediaFileName: introMediaStorageKey
                  ? introMediaFileName
                  : null,
                questionRetakes: original.questionRetakes,
                transcriptionLanguage: original.transcriptionLanguage,
                aiTranscripts: original.aiTranscripts,
                visitorCount: 0,
                viewers: 0,
                applicationsStarted: 0,
                applicationsSubmitted: 0,
                applicationCount: 0,
                createdAt: timestamp,
                updatedAt: timestamp,
                deletedAt: null,
              }),
            );

            const questions = (original.questions ?? []).filter(
              (q) => q.builtIn || !isMediaQuestionType(q.type),
            );
            if (questions.length) {
              await questionRepo.save(
                questions.map((q) => ({
                  jobId: newJobId,
                  sortOrder: q.sortOrder,
                  label: q.label,
                  type: q.type,
                  category: q.category,
                  required: q.required,
                  builtIn: q.builtIn,
                  options: q.options,
                  createdAt: timestamp,
                  updatedAt: timestamp,
                })),
              );
            }

            const fields = original.applicationFields ?? [];
            if (fields.length) {
              await fieldRepo.save(
                fields.map((f) => ({
                  jobId: newJobId,
                  sortOrder: f.sortOrder,
                  label: f.label,
                  type: f.type,
                  required: f.required,
                  builtIn: f.builtIn,
                  fieldKey: f.fieldKey,
                  createdAt: timestamp,
                  updatedAt: timestamp,
                })),
              );
            }

            const stages = original.pipelineStages ?? [];
            if (stages.length) {
              await stageRepo.save(
                stages.map((s) => ({
                  jobId: newJobId,
                  name: s.name,
                  slug: s.slug,
                  sortOrder: s.sortOrder,
                  active: s.active,
                  isDefault: s.isDefault,
                  createdAt: timestamp,
                  updatedAt: timestamp,
                })),
              );
            }

            await settingsRepo.save({
              jobId: newJobId,
              general,
              thankYouPage,
              emailAutomation: structuredClone(
                original.settings?.emailAutomation ?? DEFAULT_EMAIL_AUTOMATION,
              ),
              webhook: structuredClone(
                original.settings?.webhook ?? DEFAULT_WEBHOOK_SETTINGS,
              ),
              createdAt: timestamp,
              updatedAt: timestamp,
            });
          });

          return this.findById(newJobId, organizationId);
        } catch (error) {
          if (isPostgresUniqueViolation(error)) {
            if (attempt < maxSlugAttempts) {
              this.logger.warn(
                `duplicate slug collision attempt=${attempt} slug=${slug}; retrying`,
              );
              continue;
            }
            throw new ConflictException(JobErrors.SLUG_CONFLICT);
          }
          throw error;
        }
      }

      throw new ConflictException(JobErrors.SLUG_CONFLICT);
    } catch (error) {
      // Compensating cleanup: remove R2 objects copied before a failed DB write
      for (const key of copiedR2Keys) {
        try {
          await this.r2Service.delete(key);
        } catch (r2Error) {
          this.logger.warn(
            `Failed to cleanup duplicated R2 key=${key}: ${(r2Error as Error).message}`,
          );
        }
      }

      if (error instanceof HttpException) throw error;
      this.logger.error(
        `duplicate failed id=${id}: ${(error as Error).message}`,
      );
      throw new InternalServerErrorException(JobErrors.FAILED_TO_DUPLICATE);
    }
  }

  /** Pause an active job. */
  async pause(
    id: string,
    organizationId: string,
    userId: string,
  ): Promise<Record<string, unknown>> {
    return this.transitionStatus(
      id,
      organizationId,
      userId,
      JobStatus.ACTIVE,
      JobStatus.PAUSED,
    );
  }

  /** Resume a paused job. */
  async resume(
    id: string,
    organizationId: string,
    userId: string,
  ): Promise<Record<string, unknown>> {
    return this.transitionStatus(
      id,
      organizationId,
      userId,
      JobStatus.PAUSED,
      JobStatus.ACTIVE,
    );
  }

  /** Archive an active or paused job. */
  async archive(
    id: string,
    organizationId: string,
    userId: string,
  ): Promise<Record<string, unknown>> {
    return this.transitionStatus(
      id,
      organizationId,
      userId,
      [JobStatus.ACTIVE, JobStatus.PAUSED],
      JobStatus.ARCHIVED,
    );
  }

  /** Restore an archived job to active. */
  async restore(
    id: string,
    organizationId: string,
    userId: string,
  ): Promise<Record<string, unknown>> {
    return this.transitionStatus(
      id,
      organizationId,
      userId,
      JobStatus.ARCHIVED,
      JobStatus.ACTIVE,
    );
  }

  /** Admin preview payload for a job. */
  async preview(
    id: string,
    organizationId: string,
  ): Promise<Record<string, unknown>> {
    try {
      const job = await this.jobRepository.findByIdForOrg(id, organizationId);
      if (!job) {
        throw new NotFoundException(JobErrors.NOT_FOUND(id));
      }
      return toPublicJobResponse(job, this.configService);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`preview failed id=${id}: ${(error as Error).message}`);
      throw new InternalServerErrorException(JobErrors.FAILED_TO_PREVIEW);
    }
  }

  /** Public job page by slug — ACTIVE only. */
  async findPublicBySlug(slug: string): Promise<Record<string, unknown>> {
    try {
      const job = await this.jobRepository.findPublicBySlug(slug);
      if (!job) {
        throw new NotFoundException(JobErrors.NOT_FOUND_BY_SLUG(slug));
      }
      return toPublicJobResponse(job, this.configService);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `findPublicBySlug failed slug=${slug}: ${(error as Error).message}`,
      );
      throw new InternalServerErrorException(JobErrors.FAILED_TO_GET_PUBLIC);
    }
  }

  /**
   * Returns a presigned PUT URL for direct browser upload of intro media.
   */
  async presignIntroMediaUpload(
    id: string,
    organizationId: string,
    dto: PresignUploadDto,
  ): Promise<{ uploadUrl: string; storageKey: string; publicUrl: string }> {
    try {
      await this.assertJobAccess(id, organizationId);
      validateMediaFile(dto.contentType, dto.size, true);
      const storageKey = buildMediaKey(
        organizationId,
        id,
        'intro',
        dto.fileName,
      );
      const uploadUrl = await this.r2Service.getPresignedUploadUrl(
        storageKey,
        dto.contentType,
      );
      return {
        uploadUrl,
        storageKey,
        publicUrl: this.r2Service.getPublicUrl(storageKey),
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `presignIntroMediaUpload failed id=${id}: ${(error as Error).message}`,
      );
      throw new InternalServerErrorException(
        JobErrors.FAILED_TO_UPLOAD_INTRO_MEDIA,
      );
    }
  }

  /**
   * Persists intro media metadata after the browser uploaded directly to R2.
   */
  async confirmIntroMediaUpload(
    id: string,
    organizationId: string,
    userId: string,
    dto: ConfirmUploadDto,
  ): Promise<Record<string, unknown>> {
    try {
      const job = await this.jobRepository.findByIdForOrg(id, organizationId);
      if (!job) throw new NotFoundException(JobErrors.NOT_FOUND(id));

      assertMediaKeyScope(dto.storageKey, organizationId, id, 'intro');
      const mediaType = validateMediaFile(dto.contentType, 1, true);
      const previousKey = job.introMediaStorageKey;
      const url = this.r2Service.getPublicUrl(dto.storageKey);

      await this.jobRepository.update(id, {
        introMediaType: mediaType,
        introMediaUrl: url,
        introMediaStorageKey: dto.storageKey,
        introMediaFileName: dto.fileName,
        updatedById: userId,
        updatedAt: new Date(),
      });

      if (previousKey && previousKey !== dto.storageKey) {
        await this.r2Service.delete(previousKey);
      }

      return {
        type: mediaType,
        url,
        storageKey: dto.storageKey,
        fileName: dto.fileName,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `confirmIntroMediaUpload failed id=${id}: ${(error as Error).message}`,
      );
      throw new InternalServerErrorException(
        JobErrors.FAILED_TO_UPLOAD_INTRO_MEDIA,
      );
    }
  }

  /**
   * Clear intro media columns, then best-effort delete the R2 object.
   */
  async deleteIntroMedia(
    id: string,
    organizationId: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    try {
      const job = await this.jobRepository.findByIdForOrg(id, organizationId);
      if (!job) throw new NotFoundException(JobErrors.NOT_FOUND(id));

      const previousKey = job.introMediaStorageKey;

      await this.jobRepository.update(id, {
        introMediaType: null,
        introMediaUrl: null,
        introMediaStorageKey: null,
        introMediaFileName: null,
        updatedById: userId,
        updatedAt: new Date(),
      });

      if (previousKey) {
        try {
          await this.r2Service.delete(previousKey);
        } catch (r2Error) {
          this.logger.warn(
            `Failed to delete intro media key=${previousKey} jobId=${id}: ${(r2Error as Error).message}`,
          );
        }
      }

      return { success: true };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `deleteIntroMedia failed id=${id}: ${(error as Error).message}`,
      );
      throw new InternalServerErrorException(
        JobErrors.FAILED_TO_DELETE_INTRO_MEDIA,
      );
    }
  }

  /** Verify job exists and belongs to organization. */
  async assertJobAccess(jobId: string, organizationId: string): Promise<Job> {
    const job = await this.jobRepository.findByIdForOrg(jobId, organizationId);
    if (!job) {
      throw new NotFoundException(JobErrors.NOT_FOUND(jobId));
    }
    return job;
  }

  /** Transition a job's status. */
  private async transitionStatus(
    id: string,
    organizationId: string,
    userId: string,
    from: JobStatus | JobStatus[],
    to: JobStatus,
  ): Promise<Record<string, unknown>> {
    try {
      const job = await this.jobRepository.findByIdForOrg(id, organizationId);
      if (!job) throw new NotFoundException(JobErrors.NOT_FOUND(id));

      const allowedFrom = Array.isArray(from) ? from : [from];
      if (!allowedFrom.includes(job.status)) {
        throw new BadRequestException(
          to === JobStatus.ARCHIVED
            ? JobErrors.ONLY_ACTIVE_OR_PAUSED_CAN_ARCHIVE
            : JobErrors.INVALID_STATUS_TRANSITION(allowedFrom[0], to),
        );
      }

      await this.jobRepository.update(id, {
        status: to,
        updatedById: userId,
        updatedAt: new Date(),
      });
      return this.findById(id, organizationId);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `transitionStatus failed id=${id}: ${(error as Error).message}`,
      );
      throw new InternalServerErrorException(JobErrors.FAILED_TO_CHANGE_STATUS);
    }
  }

  /**
   * Best-effort R2 cleanup for a job's media. Never throws —
   * soft-delete / delete flows must not fail solely because R2 cleanup failed.
   */
  private async cleanupJobMedia(job: Job): Promise<void> {
    const keys: string[] = [];
    if (job.introMediaStorageKey) {
      keys.push(job.introMediaStorageKey);
    }

    const settings = job.settings;
    if (settings) {
      if (settings.thankYouPage?.storageKey) {
        keys.push(settings.thankYouPage.storageKey);
      }
      const previewKey =
        settings.general?.socialPreview?.previewImage?.storageKey;
      if (previewKey) {
        keys.push(previewKey);
      }
    }

    for (const key of keys) {
      try {
        await this.r2Service.delete(key);
      } catch (error) {
        this.logger.warn(
          `R2 cleanup failed for key=${key} jobId=${job.id}: ${(error as Error).message}`,
        );
      }
    }
  }
  /** Sync job questions with DB. */
  private async syncQuestions(
    manager: import('typeorm').EntityManager,
    jobId: string,
    questions: UpdateJobDto['questions'],
    timestamp: Date,
  ): Promise<void> {
    if (!questions) return;

    const repo = manager.getRepository(JobQuestion);
    const existing = await this.questionRepository.findByJobId(jobId);
    const builtIn = existing.find((q) => q.builtIn);
    const toInsert: DeepPartial<JobQuestion>[] = [];

    for (const q of questions) {
      if (q.type && isMediaQuestionType(q.type) && q.id !== builtIn?.id) {
        continue;
      }

      if (q.id) {
        const row = existing.find((e) => e.id === q.id);
        if (!row) continue;
        if (row.builtIn) {
          await repo.update(row.id, {
            label: q.label ?? row.label,
            required: q.required ?? row.required,
            sortOrder: q.sortOrder ?? row.sortOrder,
            updatedAt: timestamp,
          });
        } else if (q.type && isMediaQuestionType(q.type)) {
          continue;
        } else {
          await repo.update(row.id, {
            label: q.label ?? row.label,
            type: q.type ?? row.type,
            category: q.category ?? row.category,
            required: q.required ?? row.required,
            sortOrder: q.sortOrder ?? row.sortOrder,
            options: (q.options ?? row.options) as never,
            updatedAt: timestamp,
          });
        }
      } else if (q.label && q.type && !isMediaQuestionType(q.type)) {
        toInsert.push({
          jobId,
          sortOrder: q.sortOrder ?? existing.length + toInsert.length + 1,
          label: q.label,
          type: q.type,
          category: q.category ?? QuestionCategory.STANDARD,
          required: q.required ?? false,
          builtIn: false,
          options: q.options ?? null,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }
    }

    if (toInsert.length) {
      await repo.save(toInsert);
    }

    for (const row of existing) {
      if (!row.builtIn && isMediaQuestionType(row.type)) {
        await repo.softDelete(row.id);
      }
    }
  }

  /** Sync job application fields with DB. */
  private async syncApplicationFields(
    manager: import('typeorm').EntityManager,
    jobId: string,
    fields: UpdateJobDto['applicationFields'],
    timestamp: Date,
  ): Promise<void> {
    if (!fields) return;

    const repo = manager.getRepository(JobApplicationField);
    const existing = await repo.find({
      where: { jobId },
      order: { sortOrder: 'ASC' },
    });
    const toInsert: DeepPartial<JobApplicationField>[] = [];
    const keptIds = new Set<string>();

    for (const f of fields) {
      if (f.id) {
        const row = existing.find((e) => e.id === f.id);
        if (!row) continue;
        keptIds.add(row.id);
        if (row.builtIn) {
          await repo.update(row.id, {
            label: f.label ?? row.label,
            required: f.required ?? row.required,
            sortOrder: f.sortOrder ?? row.sortOrder,
            updatedAt: timestamp,
          });
        } else {
          await repo.update(row.id, {
            label: f.label ?? row.label,
            type: f.type ?? row.type,
            required: f.required ?? row.required,
            sortOrder: f.sortOrder ?? row.sortOrder,
            fieldKey: f.fieldKey ?? row.fieldKey,
            updatedAt: timestamp,
          });
        }
        continue;
      }

      if (isBuiltInApplicationFieldKey(f.fieldKey)) {
        const row = existing.find(
          (e) => e.builtIn && e.fieldKey === f.fieldKey,
        );
        if (row) {
          keptIds.add(row.id);
          await repo.update(row.id, {
            label: f.label ?? row.label,
            required: f.required ?? row.required,
            sortOrder: f.sortOrder ?? row.sortOrder,
            updatedAt: timestamp,
          });
        }
        continue;
      }

      if (f.label && f.type) {
        toInsert.push({
          jobId,
          sortOrder: f.sortOrder ?? existing.length + toInsert.length + 1,
          label: f.label,
          type: f.type,
          required: f.required ?? false,
          builtIn: false,
          fieldKey: f.fieldKey ?? null,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }
    }

    if (toInsert.length) {
      const inserted = await repo.save(toInsert);
      for (const row of inserted) {
        keptIds.add(row.id);
      }
    }

    for (const row of existing) {
      if (row.builtIn) continue;
      if (isBuiltInApplicationFieldKey(row.fieldKey)) {
        await repo.delete(row.id);
        continue;
      }
      if (!keptIds.has(row.id)) {
        await repo.delete(row.id);
      }
    }
  }
}
