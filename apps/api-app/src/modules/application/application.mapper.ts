import { Application } from './entities/application.entity';
import { ApplicationAnswer } from './application-answers/entities/application-answer.entity';
import { ApplicationNote } from './application-notes/entities/application-note.entity';
import { ApplicationFieldValue } from './application-field-values/entities/application-field-value.entity';
import { JobQuestion } from '../job/job-questions/entities/job-question.entity';
import { QuestionType } from '../job/enums/job.enums';

/**
 * Checks if a question is a video question.
 * @param question - The question to check.
 * @returns True if the question is a video question, false otherwise.
 */
function isVideoQuestion(question: JobQuestion | undefined): boolean {
    if (!question) return false;
    const type = question.type?.toLowerCase?.() ?? question.type;
    return (
        question.builtIn ||
        type === QuestionType.VIDEO.toLowerCase() ||
        type === 'video'
    );
}

/**
 * Finds a video answer in a list of answers.
 * @param answers - The answers to search.
 * @returns The video answer if found, undefined otherwise.
 */
function findVideoAnswer(answers: ApplicationAnswer[] = []): ApplicationAnswer | undefined {
    return answers.find(
        (a) =>
            a.mediaUrl ||
            a.mediaStorageKey ||
            isVideoQuestion(a.question as JobQuestion | undefined),
    );
}

/**
 * Maps an application to a list item for the admin dashboard.
 * @param application - The application to map.
 * @returns The mapped application list item.
 */
export function toApplicationListItem(
    application: Application,
): Record<string, unknown> {
    const videoAnswer = findVideoAnswer(application.answers);

    return {
        id: application.id,
        jobId: application.jobId,
        firstName: application.firstName,
        lastName: application.lastName,
        email: application.email,
        phone: application.phone,
        stageId: application.stageId,
        rating: application.rating,
        status: application.status,
        startedAt: application.startedAt,
        submittedAt: application.submittedAt,
        videoUrl: videoAnswer?.mediaUrl ?? null,
        videoThumbnail: null,
    };
}

/**
 * Map application to admin detail (candidate drawer).
 * @param application - The application to map.
 * @param questions - The questions to map.
 * @returns The mapped application.
 */
export function toApplicationDetail(
    application: Application,
    questions: JobQuestion[] = [],
): Record<string, unknown> {
    const answersByQuestion = new Map<string, ApplicationAnswer>(
        (application.answers ?? []).map((a: ApplicationAnswer) => [a.questionId, a]),
    );

    const answers = questions.map((question) => {
        const answer = answersByQuestion.get(question.id);
        const isVideo = isVideoQuestion(question);

        return {
            questionId: question.id,
            question: question.label,
            type: isVideo ? 'video' : 'text',
            answer: isVideo
                ? answer?.mediaUrl ?? ''
                : answer?.answerText ?? '',
            timestamp: answer?.updatedAt ?? answer?.createdAt ?? null,
            mediaUrl: answer?.mediaUrl ?? null,
        };
    });

    return {
        ...toApplicationListItem(application),
        notes: (application.notes ?? []).map((note: ApplicationNote) => ({
            id: note.id,
            text: note.text,
            authorId: note.authorId,
            createdAt: note.createdAt,
        })),
        answers,
        fieldValues: (application.fieldValues ?? []).map((fv: ApplicationFieldValue) => ({
            applicationFieldId: fv.applicationFieldId,
            value: fv.value,
        })),
    };
}

/**
 * Map in-progress application for public candidate session.
 */
export function toPublicApplicationSession(
    application: Application,
    accessToken: string,
): Record<string, unknown> {
    return {
        id: application.id,
        jobId: application.jobId,
        status: application.status,
        accessToken,
    };
}
