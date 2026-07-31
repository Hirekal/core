import {
    Body,
    Controller,
    Headers,
    Logger,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
} from '@nestjs/common';
import { Public } from '../../auth/common/decorators/public.decorator';
import { ConfirmUploadDto } from '../../cloud-storage/dto/confirm-upload.dto';
import { PresignUploadDto } from '../../cloud-storage/dto/presign-upload.dto';
import { toErrorMessage } from '../../../common/utils/error.util';
import { UpsertAnswerDto } from '../dto/application.dto';
import { APPLICATION_TOKEN_HEADER } from '../enums/application.enums';
import { ApplicationAnswersService } from './application-answers.service';

@Controller('public/applications')
export class ApplicationAnswersController {
    private readonly logger = new Logger(ApplicationAnswersController.name);

    constructor(
        private readonly applicationAnswersService: ApplicationAnswersService,
    ) { }

    /**
     * Upserts an answer for a given application and question.
     * @param id - The ID of the application.
     * @param questionId - The ID of the question.
     * @param token - The token of the application.
     * @param dto - The data for the answer.
     * @returns The upserted answer.
     */
    @Public()
    @Patch(':id/answers/:questionId')
    async upsertAnswer(
        @Param('id', ParseUUIDPipe) id: string,
        @Param('questionId', ParseUUIDPipe) questionId: string,
        @Headers(APPLICATION_TOKEN_HEADER) token: string,
        @Body() dto: UpsertAnswerDto,
    ) {
        try {
            return await this.applicationAnswersService.upsertAnswer(
                id,
                token,
                questionId,
                dto,
            );
        } catch (error) {
            this.logger.error(
                `Upsert answer ${id}/${questionId} failed: ${toErrorMessage(error)}`,
            );
            throw error;
        }
    }

    /**
     * Presigns a video upload URL for a given application and question.
     * @param id - The ID of the application.
     * @param questionId - The ID of the question.
     * @param token - The token of the application.
     * @param dto - The data for the video upload.
     * @returns The presigned video upload URL.
     */
    @Public()
    @Post(':id/answers/:questionId/video/upload-url')
    async presignVideo(
        @Param('id', ParseUUIDPipe) id: string,
        @Param('questionId', ParseUUIDPipe) questionId: string,
        @Headers(APPLICATION_TOKEN_HEADER) token: string,
        @Body() dto: PresignUploadDto,
    ) {
        try {
            return await this.applicationAnswersService.presignAnswerVideo(
                id,
                token,
                questionId,
                dto,
            );
        } catch (error) {
            this.logger.error(
                `Presign video ${id}/${questionId} failed: ${toErrorMessage(error)}`,
            );
            throw error;
        }
    }

    /**
     * Confirms a video upload for a given application and question.
     * @param id - The ID of the application.
     * @param questionId - The ID of the question.
     * @param token - The token of the application.
     * @param dto - The data for the video upload.
     * @returns The confirmed video upload.
     */
    @Public()
    @Post(':id/answers/:questionId/video/confirm')
    async confirmVideo(
        @Param('id', ParseUUIDPipe) id: string,
        @Param('questionId', ParseUUIDPipe) questionId: string,
        @Headers(APPLICATION_TOKEN_HEADER) token: string,
        @Body() dto: ConfirmUploadDto,
    ) {
        try {
            return await this.applicationAnswersService.confirmAnswerVideo(
                id,
                token,
                questionId,
                dto,
            );
        } catch (error) {
            this.logger.error(
                `Confirm video ${id}/${questionId} failed: ${toErrorMessage(error)}`,
            );
            throw error;
        }
    }
}
