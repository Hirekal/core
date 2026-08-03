/**
 * Video retake helpers — mirrors backend question-retakes.util.ts using UI values.
 */

const UI_TO_MAX_RETAKES = {
  none: 0,
  1: 1,
  2: 2,
  3: 3,
  unlimited: null,
};

/**
 * @param {string} [setting] - UI value: none | 1 | 2 | 3 | unlimited
 * @returns {number|null} Max re-records after first video (null = unlimited)
 */
export function getMaxRetakesFromUi(setting) {
  if (!setting) return null;
  const key = String(setting).toLowerCase();
  if (Object.prototype.hasOwnProperty.call(UI_TO_MAX_RETAKES, key)) {
    return UI_TO_MAX_RETAKES[key];
  }
  return null;
}

/**
 * @param {string} [setting]
 * @param {number} retakeCount
 * @param {boolean} hasVideo
 * @returns {boolean}
 */
export function canRetakeVideo(setting, retakeCount, hasVideo) {
  if (!hasVideo) return true;
  const maxRetakes = getMaxRetakesFromUi(setting);
  if (maxRetakes === null) return true;
  return retakeCount < maxRetakes;
}

/**
 * @param {string} [setting]
 * @param {number} retakeCount
 * @param {boolean} hasVideo
 * @returns {number|null} null = unlimited
 */
export function getRetakesRemaining(setting, retakeCount, hasVideo) {
  const maxRetakes = getMaxRetakesFromUi(setting);
  if (maxRetakes === null) return null;
  if (!hasVideo) return maxRetakes;
  return Math.max(0, maxRetakes - retakeCount);
}

/**
 * @param {string} [setting]
 * @param {number|null} remaining
 * @returns {string}
 */
export function getRetakeButtonLabel(setting, remaining) {
  const maxRetakes = getMaxRetakesFromUi(setting);
  if (maxRetakes === null) {
    return 'Re-record video';
  }
  if (remaining === null || remaining <= 0) {
    return '';
  }
  return `Retake (${remaining})`;
}

export function isRetakeLimitReached(setting, retakeCount, hasVideo) {
  return !canRetakeVideo(setting, retakeCount, hasVideo);
}
