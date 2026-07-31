/**
 * User-facing Cloudflare R2 / cloud-storage error messages.
 */
export const CloudStorageErrors = {
    NOT_CONFIGURED:
        'Cloudflare R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and R2_PUBLIC_BASE_URL.',
    PUBLIC_BASE_URL_REQUIRED: 'R2_PUBLIC_BASE_URL is not configured',
    FAILED_TO_UPLOAD: 'Failed to upload file to storage',
    FAILED_TO_COPY: 'Failed to copy file in storage',
    FAILED_TO_GET_SIGNED_URL: 'Failed to generate signed URL',
    FAILED_TO_PRESIGN_UPLOAD: 'Failed to generate upload URL',
    INVALID_STORAGE_KEY: 'Invalid storage key for this resource',
} as const;
