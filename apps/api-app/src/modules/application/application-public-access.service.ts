import {
    BadRequestException,
    Injectable,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import { JobStatus } from '../job/enums/job.enums';
import { JobQuestion } from '../job/job-questions/entities/job-question.entity';
import { ApplicationErrors } from './constants/application-errors';
import { Application } from './entities/application.entity';
import { ApplicationStatus } from './enums/application.enums';
import { ApplicationRepository } from './repositories/application.repository';
import { hashApplicationToken } from './utils/application-token.util';

const MEDIA_QUESTION_TYPES = new Set([
    'VIDEO',
    'video',
    'AUDIO',
    'audio',
    'SCREEN_RECORDING',
    'screen-recording',
    'FILE',
    'file',
]);

@Injectable()
export class ApplicationPublicAccessService {
    constructor(
        private readonly applicationRepository: ApplicationRepository,
    ) { }

    /**
     * Asserts public access to a given application.
     * @param id - The ID of the application.
     * @param token - The token of the application.
     * @returns The application with its job.
     */
    async assertPublicAccess(
        id: string,
        token: string | undefined,
    ): Promise<Application & { job: NonNullable<Application['job']> }> {
        if (!token) {
            throw new UnauthorizedException(ApplicationErrors.INVALID_TOKEN);
        }

        const application = await this.applicationRepository.findByIdWithToken(id);
        if (!application) {
            throw new NotFoundException(ApplicationErrors.NOT_FOUND(id));
        }

        if (application.status !== ApplicationStatus.IN_PROGRESS) {
            throw new BadRequestException(ApplicationErrors.NOT_IN_PROGRESS);
        }

        const hash = hashApplicationToken(token);
        if (application.sessionTokenHash !== hash) {
            throw new UnauthorizedException(ApplicationErrors.INVALID_TOKEN);
        }

        if (!application.job || application.job.status !== JobStatus.ACTIVE) {
            throw new NotFoundException(ApplicationErrors.JOB_NOT_ACCEPTING);
        }

        return application as Application & {
            job: NonNullable<Application['job']>;
        };
    }

    /**
     * Finds a job question by ID.
     * @param questions - The questions to search.
     * @param questionId - The ID of the question.
     * @returns The job question for the given ID.
     */
    findJobQuestion(
        questions: JobQuestion[],
        questionId: string,
    ): JobQuestion | undefined {
        return questions.find((q) => q.id === questionId);
    }

    /**
     * Checks if a question is a media question.
     * @param question - The question to check.
     * @returns True if the question is a media question, false otherwise.
     */
    isMediaQuestion(question: JobQuestion): boolean {
        if (question.builtIn) return true;
        const type = String(question.type);
        return (
            MEDIA_QUESTION_TYPES.has(type) ||
            MEDIA_QUESTION_TYPES.has(type.toLowerCase())
        );
    }
}
