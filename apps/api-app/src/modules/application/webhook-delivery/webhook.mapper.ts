import { Application } from '../entities/application.entity';
import { ApplicationAnswer } from '../application-answers/entities/application-answer.entity';
import { ApplicationFieldValue } from '../application-field-values/entities/application-field-value.entity';
import { JobApplicationField } from '../../job/job-application-fields/entities/job-application-field.entity';
import { JobPipelineStage } from '../../job/job-pipeline-stages/entities/job-pipeline-stage.entity';
import { JobQuestion } from '../../job/job-questions/entities/job-question.entity';
import { QuestionType } from '../../job/enums/job.enums';
import { WebhookSettings } from '../../job/job-settings/entities/job-settings.entity';
import { TranscriptionJob } from '../transcription-jobs/entities/transcription-job.entity';
import {
  TranscriptionJobStatus,
  WebhookEvent,
} from '../enums/application.enums';
import { WebhookDeliveryLog } from '../webhook-delivery-logs/entities/webhook-delivery-log.entity';

const MAX_RESPONSE_BODY_LENGTH = 2000;

/**
 * Determines if a question is a video question.
 * @param question - The question to check.
 * @returns Whether the question is a video question.
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
 * Maps a transcription job to a record.
 * @param transcription - The transcription job to map.
 * @returns The mapped transcription job.
 */
function mapTranscript(
  transcription: TranscriptionJob | undefined,
): Record<string, unknown> | null {
  if (!transcription) return null;

  return {
    status: transcription.status,
    text: transcription.transcriptText,
    language: transcription.transcriptLanguage,
    duration: transcription.transcriptDuration,
    segments: transcription.transcriptSegments,
    isPending:
      transcription.status === TranscriptionJobStatus.PENDING ||
      transcription.status === TranscriptionJobStatus.SENT,
    isFailed: transcription.status === TranscriptionJobStatus.FAILED,
    errorMessage: transcription.errorMessage,
  };
}

/**
 * Resolves the name of a stage.
 * @param stageId - The ID of the stage.
 * @param stages - The stages to resolve the name from.
 * @returns The name of the stage.
 */
function resolveStageName(
  stageId: string | null | undefined,
  stages: JobPipelineStage[],
): string | null {
  if (!stageId) return null;
  return stages.find((stage) => stage.id === stageId)?.name ?? null;
}

/**
 * Maps an application summary to a record.
 * @param application - The application to map.
 * @param stages - The stages to map the application summary from.
 * @returns The mapped application summary.
 */
function mapApplicationSummary(
  application: Application,
  stages: JobPipelineStage[],
): Record<string, unknown> {
  return {
    id: application.id,
    firstName: application.firstName,
    lastName: application.lastName,
    email: application.email,
    phone: application.phone,
    status: application.status,
    stageId: application.stageId,
    stageName:
      application.stage?.name ?? resolveStageName(application.stageId, stages),
    rating: application.rating,
    startedAt: application.startedAt,
    submittedAt: application.submittedAt,
  };
}

/**
 * Maps field values to a record.
 * @param application - The application to map.
 * @param fields - The fields to map the field values from.
 * @returns The mapped field values.
 */
function mapFieldValues(
  application: Application,
  fields: JobApplicationField[],
): Record<string, unknown>[] {
  const valuesByFieldId = new Map<string, ApplicationFieldValue>(
    (application.fieldValues ?? []).map((value) => [
      value.applicationFieldId,
      value,
    ]),
  );

  return fields
    .filter((field) => !field.builtIn)
    .map((field) => ({
      fieldId: field.id,
      label: field.label,
      type: field.type,
      value: valuesByFieldId.get(field.id)?.value ?? null,
    }));
}

/**
 * Maps answers to a record.
 * @param application - The application to map.
 * @param questions - The questions to map the answers from.
 * @param settings - The webhook settings.
 * @param transcriptionByAnswerId - The transcription jobs by answer ID.
 * @returns The mapped answers.
 */
function mapAnswers(
  application: Application,
  questions: JobQuestion[],
  settings: WebhookSettings,
  transcriptionByAnswerId: Map<string, TranscriptionJob>,
): Record<string, unknown>[] {
  const answersByQuestion = new Map<string, ApplicationAnswer>(
    (application.answers ?? []).map((answer) => [answer.questionId, answer]),
  );

  return questions.map((question) => {
    const answer = answersByQuestion.get(question.id);
    const isVideo = isVideoQuestion(question);
    const item: Record<string, unknown> = {
      questionId: question.id,
      question: question.label,
      type: isVideo ? 'video' : 'text',
    };

    if (isVideo) {
      if (settings.includeVideoUrls) {
        item.answer = answer?.mediaUrl ?? '';
        item.mediaUrl = answer?.mediaUrl ?? null;
      } else {
        item.answer = '';
      }
    } else {
      item.answer = answer?.answerText ?? '';
    }

    item.timestamp = answer?.updatedAt ?? answer?.createdAt ?? null;

    if (settings.includeAiTranscripts && isVideo) {
      const transcription = answer
        ? transcriptionByAnswerId.get(answer.id)
        : undefined;
      item.transcript = mapTranscript(transcription);
    }

    return item;
  });
}

/**
 * The parameters for building a webhook payload.
 * @param event - The type of event.
 * @param jobId - The ID of the job.
 * @param application - The application to map.
 * @param settings - The webhook settings.
 * @param questions - The questions to map the answers from.
 * @param applicationFields - The fields to map the field values from.
 * @param stages - The stages to map the application summary from.
 * @param transcriptionByAnswerId - The transcription jobs by answer ID.
 * @param stageChange - The stage change.
 */
export interface BuildWebhookPayloadParams {
  event: WebhookEvent;
  jobId: string;
  application: Application;
  settings: WebhookSettings;
  questions: JobQuestion[];
  applicationFields: JobApplicationField[];
  stages: JobPipelineStage[];
  transcriptionByAnswerId?: Map<string, TranscriptionJob>;
  stageChange?: {
    fromStageId: string | null;
    toStageId: string | null;
  };
}

/**
 * Builds the JSON body sent to the configured webhook URL.
 * @param params - The parameters for building the webhook payload.
 * @returns The built webhook payload.
 */
export function buildWebhookPayload(
  params: BuildWebhookPayloadParams,
): Record<string, unknown> {
  const {
    event,
    jobId,
    application,
    settings,
    questions,
    applicationFields,
    stages,
    transcriptionByAnswerId = new Map<string, TranscriptionJob>(),
    stageChange,
  } = params;

  const payload: Record<string, unknown> = {
    event,
    timestamp: new Date().toISOString(),
    jobId,
    applicationId: application.id,
    application: mapApplicationSummary(application, stages),
  };

  if (event === WebhookEvent.STAGE_CHANGE && stageChange) {
    payload.stageChange = {
      fromStageId: stageChange.fromStageId,
      fromStageName: resolveStageName(stageChange.fromStageId, stages),
      toStageId: stageChange.toStageId,
      toStageName: resolveStageName(stageChange.toStageId, stages),
    };
  }

  if (settings.includeAnswers) {
    payload.fieldValues = mapFieldValues(application, applicationFields);
    payload.answers = mapAnswers(
      application,
      questions,
      settings,
      transcriptionByAnswerId,
    );
  }

  return payload;
}

/**
 * Truncates response bodies before persisting to the log table.
 * @param body - The body to truncate.
 * @returns The truncated body.
 */
export function truncateResponseBody(body: string | null): string | null {
  if (!body) return null;
  if (body.length <= MAX_RESPONSE_BODY_LENGTH) return body;
  return `${body.slice(0, MAX_RESPONSE_BODY_LENGTH)}…`;
}

/**
 * Maps a delivery log row to an API response object.
 * @param log - The delivery log to map.
 * @returns The mapped delivery log.
 */
export function toWebhookLogResponse(
  log: WebhookDeliveryLog,
): Record<string, unknown> {
  return {
    id: log.id,
    jobId: log.jobId,
    applicationId: log.applicationId,
    event: log.event,
    status: log.status,
    requestUrl: log.requestUrl,
    responseStatus: log.responseStatus,
    responseBody: log.responseBody,
    errorMessage: log.errorMessage,
    createdAt: log.createdAt,
  };
}
