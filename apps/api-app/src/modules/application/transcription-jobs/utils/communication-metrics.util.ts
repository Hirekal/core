/**
 * Recruiter-facing communication metrics derived from media-worker
 * speech + assessment payloads. Pure math only — no LLM.
 */

export type MetricRatingLabel =
  | 'Excellent'
  | 'Good'
  | 'Fair'
  | 'Needs Improvement';

export type SpeakingPaceLabel =
  | 'Too Slow'
  | 'Slow'
  | 'Ideal'
  | 'Fast'
  | 'Too Fast';

export interface ScoreWithLabel {
  score: number;
  label: MetricRatingLabel;
}

export interface SpeakingPaceMetric {
  wpm: number;
  label: SpeakingPaceLabel;
}

export interface PauseAnalysisMetric {
  averagePause: number | null;
  longestPause: number | null;
  speechRatio: number | null;
  speechDuration: number | null;
  silenceDuration: number | null;
}

export interface CommunicationMetrics {
  communicationScore: ScoreWithLabel;
  speechClarity: ScoreWithLabel;
  fluency: ScoreWithLabel;
  speakingPace: SpeakingPaceMetric;
  pronunciation: ScoreWithLabel;
  prosody: ScoreWithLabel;
  pauseAnalysis: PauseAnalysisMetric;
}

/** Snake_case speech block as sent by the media worker. */
export interface SpeechMetricsInput {
  language?: string | null;
  language_confidence?: number | null;
  speech_duration?: number | null;
  silence_duration?: number | null;
  speech_ratio?: number | null;
  average_pause_duration?: number | null;
  longest_pause_duration?: number | null;
  speaking_rate?: number | null;
}

/** Snake_case assessment block as sent by the media worker. */
export interface AssessmentInput {
  pronunciation_accuracy: number;
  prosody_score: number;
  fluency_score: number;
  completeness_score?: number | null;
  reference_text?: string;
  asr_transcript?: string;
}

/**
 * Maps a score to a human-readable label.
 * @param score - The score to map.
 * @returns The human-readable label.
 */
function ratingLabel(score: number): MetricRatingLabel {
  if (score >= 95) return 'Excellent';
  if (score >= 85) return 'Good';
  if (score >= 70) return 'Fair';
  return 'Needs Improvement';
}

/**
 * Rounds a number to the nearest integer.
 * @param value - The number to round.
 * @returns The nearest integer.
 */
function roundToNearestInt(value: number): number {
  return Math.round(value);
}

/**
 * Maps speaking rate (WPM) to a 0–100 pace quality score.
 */
export function calculateSpeakingPaceScore(speakingRate: number): number {
  if (speakingRate < 100) return 70;
  if (speakingRate <= 119) return 90;
  if (speakingRate <= 160) return 100;
  if (speakingRate <= 180) return 90;
  if (speakingRate <= 200) return 80;
  return 70;
}

/**
 * Human-readable pace band for a speaking rate (WPM).
 */
export function getSpeakingPaceLabel(speakingRate: number): SpeakingPaceLabel {
  if (speakingRate < 100) return 'Too Slow';
  if (speakingRate <= 119) return 'Slow';
  if (speakingRate <= 160) return 'Ideal';
  if (speakingRate <= 180) return 'Fast';
  return 'Too Fast';
}

/**
 * Pause quality score from average pause duration and speech ratio.
 */
export function calculatePauseQualityScore(
  averagePauseDuration: number | null | undefined,
  speechRatio: number | null | undefined,
): number {
  if (averagePauseDuration == null) {
    return 70;
  }

  if (
    averagePauseDuration <= 0.5 &&
    speechRatio != null &&
    speechRatio >= 95
  ) {
    return 100;
  }

  if (averagePauseDuration <= 0.8) return 90;
  if (averagePauseDuration <= 1.2) return 80;
  return 70;
}

/**
 * Speech clarity: 50% pronunciation + 30% fluency + 20% prosody.
 */
export function calculateSpeechClarity(
  pronunciationAccuracy: number,
  fluencyScore: number,
  prosodyScore: number,
): ScoreWithLabel {
  const score = roundToNearestInt(
    pronunciationAccuracy * 0.5 + fluencyScore * 0.3 + prosodyScore * 0.2,
  );
  return { score, label: ratingLabel(score) };
}

/**
 * Overall communication score from weighted assessment + pace/pause scores.
 */
export function calculateCommunicationScore(params: {
  pronunciationAccuracy: number;
  fluencyScore: number;
  prosodyScore: number;
  completenessScore: number;
  paceScore: number;
  pauseScore: number;
}): ScoreWithLabel {
  const score = roundToNearestInt(
    params.pronunciationAccuracy * 0.3 +
      params.fluencyScore * 0.25 +
      params.prosodyScore * 0.2 +
      params.completenessScore * 0.1 +
      params.paceScore * 0.1 +
      params.pauseScore * 0.05,
  );
  return { score, label: ratingLabel(score) };
}

/**
 * Builds the full recruiter metrics object from worker speech + assessment.
 * Returns null when assessment is missing (cannot derive scores).
 */
export function buildCommunicationMetrics(
  speech: SpeechMetricsInput | null | undefined,
  assessment: AssessmentInput | null | undefined,
): CommunicationMetrics | null {
  if (!assessment) {
    return null;
  }

  const pronunciationAccuracy = assessment.pronunciation_accuracy;
  const fluencyScore = assessment.fluency_score;
  const prosodyScore = assessment.prosody_score;
  const completenessScore = assessment.completeness_score ?? 0;

  const speakingRate = speech?.speaking_rate ?? null;
  const paceScore =
    speakingRate != null ? calculateSpeakingPaceScore(speakingRate) : 0;
  const pauseScore = calculatePauseQualityScore(
    speech?.average_pause_duration,
    speech?.speech_ratio,
  );

  return {
    communicationScore: calculateCommunicationScore({
      pronunciationAccuracy,
      fluencyScore,
      prosodyScore,
      completenessScore,
      paceScore,
      pauseScore,
    }),
    speechClarity: calculateSpeechClarity(
      pronunciationAccuracy,
      fluencyScore,
      prosodyScore,
    ),
    fluency: {
      score: fluencyScore,
      label: ratingLabel(fluencyScore),
    },
    speakingPace: {
      wpm: speakingRate ?? 0,
      label:
        speakingRate != null
          ? getSpeakingPaceLabel(speakingRate)
          : 'Too Slow',
    },
    pronunciation: {
      score: pronunciationAccuracy,
      label: ratingLabel(pronunciationAccuracy),
    },
    prosody: {
      score: prosodyScore,
      label: ratingLabel(prosodyScore),
    },
    pauseAnalysis: {
      averagePause: speech?.average_pause_duration ?? null,
      longestPause: speech?.longest_pause_duration ?? null,
      speechRatio: speech?.speech_ratio ?? null,
      speechDuration: speech?.speech_duration ?? null,
      silenceDuration: speech?.silence_duration ?? null,
    },
  };
}
