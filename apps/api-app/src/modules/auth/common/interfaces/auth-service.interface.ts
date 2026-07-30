import { Organization } from '../../organization/entities/organization.entity';
import { User } from '../../users/entities/user.entity';
import { AuthTokensResponse } from './auth-response.interface';

export interface SignupExistingUserResponse {
  user: User;
  message: string;
  verificationCode?: string;
}

export interface SignupNewUserResponse {
  user: User;
  organization: Organization;
  message: string;
  verificationCode?: string;
}

export type SignupResponse = SignupExistingUserResponse | SignupNewUserResponse;

export interface SigninResponse extends AuthTokensResponse {
  user: User;
}

export interface MessageResponse {
  message: string;
}

export interface ForgotPasswordResponse extends MessageResponse {
  resetCode?: string;
}

export interface ResendVerificationResponse extends MessageResponse {
  verificationCode?: string;
}

export interface VerifyCodeResponse extends MessageResponse {
  type: string;
}

export interface UpdateProfilePatch {
  name?: string;
  metadata?: Record<string, unknown>;
  updatedBy: string;
}
