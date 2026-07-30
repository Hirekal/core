import { Organization } from '../../organization/entities/organization.entity';
import { User } from '../../users/entities/user.entity';
import { AuthTokensResponse } from './auth-response.interface';

export interface SignupExistingUserResponse {
  user: User;
  verificationCode: string;
}

export interface SignupNewUserResponse {
  user: User;
  organization: Organization;
  verificationCode: string;
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

export interface VerifyCodeResponse extends MessageResponse {
  type: string;
}

export interface UpdateProfilePatch {
  name?: string;
  password?: string;
  metadata?: Record<string, unknown>;
  updatedBy: string;
}
