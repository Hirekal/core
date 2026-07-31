import { apiRequest, putToSignedUrl } from './apiClient';
import { mediaToUploadFile } from '../utils/mediaHelpers';

/**
 * Converts recorded/uploaded media into a File for direct R2 upload.
 *
 * @param {{ blob?: Blob, url?: string, type?: string, fileName?: string }} media
 * @returns {Promise<File|null>}
 */
export async function mediaToFile(media) {
  return mediaToUploadFile(media);
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
