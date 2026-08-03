import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CloudStorageErrors } from './constants/cloud-storage-errors';

/**
 * Cloudflare R2 (S3-compatible) storage client.
 *
 * Client is created lazily so the API can boot without R2 env vars
 * until an upload/copy/signed-url operation is actually invoked.
 */
@Injectable()
export class R2Service {
  private readonly logger = new Logger(R2Service.name);
  private client: S3Client | null = null;
  private bucketName: string | null = null;
  private publicBaseUrl: string | null = null;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Ensure the S3/R2 client is configured before performing IO.
   * @returns The S3/R2 client, bucket name, and public base URL.
   */
  private ensureClient(): {
    client: S3Client;
    bucketName: string;
    publicBaseUrl: string;
  } {
    if (this.client && this.bucketName && this.publicBaseUrl) {
      return {
        client: this.client,
        bucketName: this.bucketName,
        publicBaseUrl: this.publicBaseUrl,
      };
    }

    const accountId = this.configService.get<string>('R2_ACCOUNT_ID');
    const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'R2_SECRET_ACCESS_KEY',
    );
    const bucketName = this.configService.get<string>('R2_BUCKET_NAME');
    const publicBaseUrl = this.configService.get<string>('R2_PUBLIC_BASE_URL');

    if (
      !accountId ||
      !accessKeyId ||
      !secretAccessKey ||
      !bucketName ||
      !publicBaseUrl
    ) {
      throw new InternalServerErrorException(CloudStorageErrors.NOT_CONFIGURED);
    }

    const endpoint =
      this.configService.get<string>('R2_ENDPOINT') ??
      `https://${accountId}.r2.cloudflarestorage.com`;

    this.client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      // Avoid checksum query params on presigned URLs — browsers cannot send them on PUT.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
    this.bucketName = bucketName;
    this.publicBaseUrl = publicBaseUrl;

    return {
      client: this.client,
      bucketName: this.bucketName,
      publicBaseUrl: this.publicBaseUrl,
    };
  }

  /**
   * Uploads an object to R2.
   * @param key - The key of the object.
   * @param body - The body of the object.
   * @param contentType - The content type of the object.
   * @returns The void.
   */
  async upload(key: string, body: Buffer, contentType: string): Promise<void> {
    try {
      const { client, bucketName } = this.ensureClient();
      await client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `upload failed key=${key}: ${(error as Error).message}`,
      );
      throw new InternalServerErrorException(
        CloudStorageErrors.FAILED_TO_UPLOAD,
      );
    }
  }

  /**
   * Delete an object from R2. Best-effort — logs and never throws
   * (callers must not fail a successful DB write solely because R2 cleanup failed).
   * @param key - The key of the object.
   * @returns The void.
   */
  async delete(key: string): Promise<void> {
    if (!key) return;

    try {
      const { client, bucketName } = this.ensureClient();
      await client.send(
        new DeleteObjectCommand({
          Bucket: bucketName,
          Key: key,
        }),
      );
    } catch (error) {
      this.logger.warn(
        `Failed to delete R2 object key=${key}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Copy an object within the bucket (used by job duplicate).
   * @param fromKey - The key of the object to copy from.
   * @param toKey - The key of the object to copy to.
   * @returns The void.
   */
  async copy(fromKey: string, toKey: string): Promise<void> {
    if (!fromKey || !toKey) return;

    try {
      const { client, bucketName } = this.ensureClient();
      await client.send(
        new CopyObjectCommand({
          Bucket: bucketName,
          CopySource: `${bucketName}/${fromKey}`,
          Key: toKey,
        }),
      );
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `copy failed from=${fromKey} to=${toKey}: ${(error as Error).message}`,
      );
      throw new InternalServerErrorException(CloudStorageErrors.FAILED_TO_COPY);
    }
  }

  /**
   * Build the public URL for an object key (no network I/O).
   * @param key - The key of the object.
   * @returns The public URL for the object.
   */
  getPublicUrl(key: string): string {
    if (!key) return '';
    const publicBaseUrl =
      this.publicBaseUrl ??
      this.configService.get<string>('R2_PUBLIC_BASE_URL');
    if (!publicBaseUrl) {
      throw new InternalServerErrorException(
        CloudStorageErrors.PUBLIC_BASE_URL_REQUIRED,
      );
    }
    const base = publicBaseUrl.replace(/\/$/, '');
    return `${base}/${key}`;
  }

  /**
   * Generate a presigned PUT URL so the browser can upload directly to R2.
   * @param key - The key of the object.
   * @param contentType - The content type of the object.
   * @param expiresInSeconds - The number of seconds the URL should be valid for.
   * @returns The presigned upload URL.
   */
  async getPresignedUploadUrl(
    key: string,
    contentType: string,
    expiresInSeconds = 3600,
  ): Promise<string> {
    try {
      const { client, bucketName } = this.ensureClient();
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        ContentType: contentType,
      });
      return await getSignedUrl(client, command, {
        expiresIn: expiresInSeconds,
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `getPresignedUploadUrl failed key=${key}: ${(error as Error).message}`,
      );
      throw new InternalServerErrorException(
        CloudStorageErrors.FAILED_TO_PRESIGN_UPLOAD,
      );
    }
  }

  /**
   * Generate a signed URL for private bucket access (GET).
   * @param key - The key of the object.
   * @param expiresInSeconds - The number of seconds the URL should be valid for.
   * @returns The signed URL.
   */
  async getSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    try {
      const { client, bucketName } = this.ensureClient();
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      });
      return await getSignedUrl(client, command, {
        expiresIn: expiresInSeconds,
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `getSignedUrl failed key=${key}: ${(error as Error).message}`,
      );
      throw new InternalServerErrorException(
        CloudStorageErrors.FAILED_TO_GET_SIGNED_URL,
      );
    }
  }
}
