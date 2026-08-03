import { QuestionRetakes } from '../enums/job.enums';

/**
 * Max re-records allowed after the initial video (null = unlimited).
 */
export function getMaxRetakes(
    setting: QuestionRetakes | string | null | undefined,
): number | null {
    switch (setting) {
        case QuestionRetakes.NONE:
            return 0;
        case QuestionRetakes.ONE:
            return 1;
        case QuestionRetakes.TWO:
            return 2;
        case QuestionRetakes.THREE:
            return 3;
        case QuestionRetakes.UNLIMITED:
            return null;
        default:
            return null;
    }
}

export function hasExistingVideoAnswer(answer: {
    mediaUrl?: string | null;
    mediaStorageKey?: string | null;
} | null | undefined): boolean {
    return Boolean(answer?.mediaUrl || answer?.mediaStorageKey);
}

/**
 * Whether another video upload is allowed for this answer.
 */
export function canReplaceVideoAnswer(
    maxRetakes: number | null,
    retakeCount: number,
    hasExistingVideo: boolean,
): boolean {
    if (!hasExistingVideo) {
        return true;
    }
    if (maxRetakes === null) {
        return true;
    }
    return retakeCount < maxRetakes;
}

/** Remaining re-records after the current saved video (null = unlimited). */
export function getRetakesRemaining(
    maxRetakes: number | null,
    retakeCount: number,
    hasExistingVideo: boolean,
): number | null {
    if (maxRetakes === null) {
        return null;
    }
    if (!hasExistingVideo) {
        return maxRetakes;
    }
    return Math.max(0, maxRetakes - retakeCount);
}
