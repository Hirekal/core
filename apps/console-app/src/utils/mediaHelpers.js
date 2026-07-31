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

/**
 * Parses a data URL into a File without using fetch().
 * fetch(data:...) breaks when the MIME type contains commas
 * (e.g. video/webm;codecs=vp8,opus), which corrupts R2 uploads.
 *
 * @param {string} dataUrl
 * @param {string} [fileName]
 * @param {'video'|'image'} [mediaType]
 * @returns {File}
 */
export function dataUrlToFile(dataUrl, fileName, mediaType = 'video') {
  const marker = 'base64,';
  const markerIndex = dataUrl.indexOf(marker);
  if (!dataUrl.startsWith('data:') || markerIndex === -1) {
    throw new Error('Invalid media data URL');
  }

  const meta = dataUrl.slice(5, markerIndex - 1);
  const mime =
    meta.split(';')[0] ||
    (mediaType === 'video' ? 'video/webm' : 'application/octet-stream');
  const base64 = dataUrl.slice(markerIndex + marker.length);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  const defaultName = mediaType === 'video' ? 'recording.webm' : 'upload.png';
  return new File([bytes], fileName || defaultName, { type: mime });
}

/**
 * @param {{ blob?: Blob, url?: string, type?: string, fileName?: string }} media
 * @returns {Promise<File|null>}
 */
export async function mediaToUploadFile(media) {
  if (!media) return null;

  if (media.blob instanceof Blob) {
    const mime =
      media.blob.type?.split(';')[0] ||
      (media.type === 'video' ? 'video/webm' : 'application/octet-stream');
    const defaultName = media.type === 'video' ? 'recording.webm' : 'upload.bin';
    return new File([media.blob], media.fileName || defaultName, { type: mime });
  }

  if (media.url?.startsWith('data:')) {
    return dataUrlToFile(media.url, media.fileName, media.type);
  }

  if (media.url) {
    const response = await fetch(media.url);
    const blob = await response.blob();
    const extension = media.type === 'video' ? 'webm' : 'png';
    const contentType =
      blob.type && blob.type !== 'application/octet-stream'
        ? blob.type.split(';')[0]
        : media.type === 'video'
          ? 'video/webm'
          : 'image/png';
    return new File([blob], media.fileName || `media.${extension}`, {
      type: contentType,
    });
  }

  return null;
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
