import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Request body after the browser PUTs a file directly to R2.
 */
export class ConfirmUploadDto {
    @IsString()
    @IsNotEmpty()
    storageKey!: string;

    @IsString()
    @IsNotEmpty()
    fileName!: string;

    @IsString()
    @IsNotEmpty()
    contentType!: string;
}
