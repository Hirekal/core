import { apiRequest, putToSignedUrl } from './apiClient';

/**
 * Converts a data/blob URL into a File for direct R2 upload.
 *
 * @param {{ url?: string, type?: string, fileName?: string }} media
 * @returns {Promise<File|null>}
 */
export async function mediaToFile(media) {
  if (!media?.url) return null;

  const response = await fetch(media.url);
  const blob = await response.blob();
  const extension = media.type === 'video' ? 'webm' : 'png';
  const fileName = media.fileName || `media.${extension}`;
  const contentType =
    blob.type && blob.type !== 'application/octet-stream'
      ? blob.type
      : media.type === 'video'
        ? 'video/webm'
        : 'image/png';

  return new File([blob], fileName, { type: contentType });
}

/**
 * Uploads a file directly to R2 via presigned URL (browser → R2, not through API).
 *
 * @param {string} uploadUrlPath - API path that returns { uploadUrl, storageKey, publicUrl }
 * @param {string} confirmPath - API path to persist metadata after PUT
 * @param {File|Blob} file
 * @param {string} [fileName] - Override filename when file is a Blob
 * @returns {Promise<object>} Confirmed upload payload from API
 */
export async function uploadFileViaPresignedUrl(
  uploadUrlPath,
  confirmPath,
  file,
  fileName,
) {
  const resolvedName =
    fileName || (file instanceof File ? file.name : 'upload.bin');
  const contentType = file.type || 'application/octet-stream';

  const presign = await apiRequest(uploadUrlPath, {
    method: 'POST',
    auth: true,
    body: {
      fileName: resolvedName,
      contentType,
      size: file.size,
    },
  });

  await putToSignedUrl(presign.uploadUrl, file, contentType);

  return apiRequest(confirmPath, {
    method: 'POST',
    auth: true,
    body: {
      storageKey: presign.storageKey,
      fileName: resolvedName,
      contentType,
    },
  });
}
