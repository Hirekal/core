import { UserCode } from '../../users/user-codes/entities/user-code.entity';

export interface AuthTokensResponse {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
}

export interface UserCodeCreateResult {
  code: string;
  entity: UserCode;
}
