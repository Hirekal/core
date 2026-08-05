import { Application } from './entities/application.entity';
import { ApplicationAnswer } from './application-answers/entities/application-answer.entity';
import { ApplicationNote } from './application-notes/entities/application-note.entity';
import { ApplicationFieldValue } from './application-field-values/entities/application-field-value.entity';
import { JobApplicationField } from '../job/job-application-fields/entities/job-application-field.entity';
import { JobQuestion } from '../job/job-questions/entities/job-question.entity';
import { ApplicationFieldType, QuestionType } from '../job/enums/job.enums';
import { TranscriptionJob } from './transcription-jobs/entities/transcription-job.entity';
import { TranscriptionJobStatus } from './enums/application.enums';
import { parseFieldFileValue } from './utils/application-field-file.util';
import { Logger } from '@nestjs/common';

const logger = new Logger('ApplicationMapper');

/**
 * Checks if a question is a video question.
 * @param question - The question to check.
 * @returns True if the question is a video question, false otherwise.
 */
function isVideoQuestion(question: JobQuestion | undefined): boolean {
  try {
    if (!question) return false;
    const type = question.type?.toLowerCase?.() ?? question.type;
    return (
      question.builtIn ||
      type === QuestionType.VIDEO.toLowerCase() ||
      type === 'video'
    );
  } catch (error) {
    logger.error(`isVideoQuestion failed: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Finds a video answer in a list of answers.
 * @param answers - The answers to search.
 * @returns The video answer if found, undefined otherwise.
 */
function findVideoAnswer(
  answers: ApplicationAnswer[] = [],
): ApplicationAnswer | undefined {
  try {
    return answers.find(
      (a) =>
        a.mediaUrl ||
        a.mediaStorageKey ||
        isVideoQuestion(a.question as JobQuestion | undefined),
    );
  } catch (error) {
    logger.error(`findVideoAnswer failed: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Maps a transcription job into the API transcript shape.
 * @param transcription - The transcription job to map.
 * @returns Mapped transcript fields, or null when absent.
 */
function mapTranscript(
  transcription: TranscriptionJob | undefined,
): Record<string, unknown> | null {
  try {
    if (!transcription) return null;

    return {
      status: transcription.status,
      text: transcription.transcriptText,
      language: transcription.transcriptLanguage,
      duration: transcription.transcriptDuration,
      segments: transcription.transcriptSegments,
      speech: transcription.speechMetrics,
      assessment: transcription.assessment,
      communicationMetrics: transcription.communicationMetrics,
      isPending:
        transcription.status === TranscriptionJobStatus.PENDING ||
        transcription.status === TranscriptionJobStatus.SENT,
      isFailed: transcription.status === TranscriptionJobStatus.FAILED,
      errorMessage: transcription.errorMessage,
    };
  } catch (error) {
    logger.error(`mapTranscript failed: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Maps an application to a list item for the admin dashboard.
 * @param application - The application to map.
 * @returns The mapped application list item.
 */
export function toApplicationListItem(
  application: Application,
): Record<string, unknown> {
  try {
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
  } catch (error) {
    logger.error(
      `toApplicationListItem failed id=${application?.id}: ${(error as Error).message}`,
    );
    throw error;
  }
}

/**
 * Map application to admin detail (candidate drawer).
 * @param application - The application to map.
 * @param questions - The questions to map.
 * @param transcriptionByAnswerId - Transcription jobs keyed by answer id.
 * @param applicationFields - Job application fields for custom field values.
 * @returns The mapped application.
 */
export function toApplicationDetail(
  application: Application,
  questions: JobQuestion[] = [],
  transcriptionByAnswerId: Map<string, TranscriptionJob> = new Map(),
  applicationFields: JobApplicationField[] = [],
): Record<string, unknown> {
  try {
    const answersByQuestion = new Map<string, ApplicationAnswer>(
      (application.answers ?? []).map((a: ApplicationAnswer) => [
        a.questionId,
        a,
      ]),
    );

    const answers = questions.map((question) => {
      const answer = answersByQuestion.get(question.id);
      const isVideo = isVideoQuestion(question);
      const transcription = answer
        ? transcriptionByAnswerId.get(answer.id)
        : undefined;

      return {
        questionId: question.id,
        question: question.label,
        type: isVideo ? 'video' : 'text',
        answer: isVideo ? (answer?.mediaUrl ?? '') : (answer?.answerText ?? ''),
        timestamp: answer?.updatedAt ?? answer?.createdAt ?? null,
        mediaUrl: answer?.mediaUrl ?? null,
        transcript: mapTranscript(transcription),
      };
    });

    const valuesByFieldId = new Map(
      (application.fieldValues ?? []).map((fv: ApplicationFieldValue) => [
        fv.applicationFieldId,
        fv,
      ]),
    );

    const customFields = [...applicationFields]
      .filter((field) => !field.builtIn)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    return {
      ...toApplicationListItem(application),
      notes: (application.notes ?? []).map((note: ApplicationNote) => ({
        id: note.id,
        text: note.text,
        authorId: note.authorId,
        createdAt: note.createdAt,
      })),
      answers,
      fieldValues: customFields.map((field) => {
        const fv = valuesByFieldId.get(field.id);
        const isFile =
          field.type === ApplicationFieldType.FILE ||
          String(field.type || '').toUpperCase() === 'FILE';
        const raw = fv?.value ?? null;
        const parsedFile = isFile ? parseFieldFileValue(raw) : null;

        return {
          applicationFieldId: field.id,
          label: field.label,
          type: field.type,
          required: Boolean(field.required),
          value: parsedFile ?? raw,
        };
      }),
    };
  } catch (error) {
    logger.error(
      `toApplicationDetail failed id=${application?.id}: ${(error as Error).message}`,
    );
    throw error;
  }
}

/**
 * Map in-progress application for public candidate session.
 * @param application - The application to map.
 * @param accessToken - Plaintext session token returned to the client.
 * @returns Public session payload including access token.
 */
export function toPublicApplicationSession(
  application: Application,
  accessToken: string,
): Record<string, unknown> {
  try {
    return {
      id: application.id,
      jobId: application.jobId,
      status: application.status,
      accessToken,
    };
  } catch (error) {
    logger.error(
      `toPublicApplicationSession failed id=${application?.id}: ${(error as Error).message}`,
    );
    throw error;
  }
}
