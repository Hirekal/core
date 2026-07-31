/**
 * @fileoverview Data transfer object for token refresh requests.
 * Validates the refresh token submitted to obtain new access credentials.
 */

import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Payload for exchanging a refresh token for new access tokens.
 *
 * Used by the token refresh endpoint. The client submits a valid refresh
 * token to receive a rotated pair of access and refresh tokens.
 */
export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
