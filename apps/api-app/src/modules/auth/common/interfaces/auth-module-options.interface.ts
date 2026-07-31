export const AUTH_MODULE_OPTIONS = 'AUTH_MODULE_OPTIONS';

export interface AuthModuleOptions {
  jwtSecret: string;
  jwtAccessExpiresIn?: string | number;
  jwtRefreshExpiresIn?: string | number;
}
