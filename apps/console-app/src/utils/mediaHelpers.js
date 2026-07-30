export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/gif,image/webp';
export const VIDEO_ACCEPT = 'video/mp4,video/webm,video/quicktime,video/x-msvideo';

export function getMediaErrorMessage(error) {
  const name = error?.name || '';
  const message = error?.message || '';

  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Camera and microphone access was denied. Allow permissions in your browser settings and try again.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No camera or microphone was found on this device.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'Camera or microphone is already in use by another application.';
  }
  if (name === 'OverconstrainedError') {
    return 'Your device does not support the requested camera settings.';
  }
  if (name === 'SecurityError') {
    return 'Media access is blocked. Use HTTPS or localhost to record video.';
  }

  return message || 'Unable to access camera or microphone.';
}

export function validateImageFile(file) {
  if (!file) return 'No file selected.';
  if (!file.type.startsWith('image/')) return 'Please select a valid image file (JPEG, PNG, GIF, or WebP).';
  if (file.size > MAX_IMAGE_BYTES) return 'Image must be smaller than 10 MB.';
  return null;
}

export function validateVideoFile(file) {
  if (!file) return 'No file selected.';
  if (!file.type.startsWith('video/')) return 'Please select a valid video file (MP4, WebM, or MOV).';
  if (file.size > MAX_VIDEO_BYTES) return 'Video must be smaller than 100 MB.';
  return null;
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

export function blobToDataUrl(blob) {
  return readFileAsDataUrl(blob);
}

export function getSupportedVideoMimeType() {
  const types = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ];
  return types.find((type) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) || '';
}

export function isVideoMedia(media) {
  return media?.type === 'video';
}

export function isImageMedia(media) {
  return media?.type === 'image';
}
