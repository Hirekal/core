import { IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';

/** Max upload size we presign (100MB video cap). */
const MAX_PRESIGN_BYTES = 100 * 1024 * 1024;

/**
 * Request body for generating a presigned direct-to-R2 upload URL.
 */
export class PresignUploadDto {
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @IsString()
  @IsNotEmpty()
  contentType!: string;

  @IsInt()
  @Min(1)
  @Max(MAX_PRESIGN_BYTES)
  size!: number;
}
