import { JobQuestion } from '../../../job/job-questions/entities/job-question.entity';

/**
 * Checks if a question is a media question.
 * @param question - The question to check.
 * @returns True if the question is a media question, false otherwise.
 */
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

/**
 * Checks if a question is a media question.
 * @param question - The question to check.
 * @returns True if the question is a media question, false otherwise.
 */
export function isMediaQuestion(question: JobQuestion): boolean {
    if (question.builtIn) return true;
    const type = String(question.type);
    return (
        MEDIA_QUESTION_TYPES.has(type) ||
        MEDIA_QUESTION_TYPES.has(type.toLowerCase())
    );
}
