export const ERROR_MESSAGES = {
  CONFIG: {
    MISSING_ENV: (key: string) =>
      `Missing required environment variable: ${key}`,
  },
  COMMON: {
    INTERNAL_SERVER_ERROR: 'Internal server error',
  },
} as const;

export const SUCCESS_MESSAGES = {
  COMMON: {
    OK: 'OK',
  },
  HEALTH: {
    STATUS: 'ok',
  },
} as const;

export const INFO_MESSAGES = {
  SERVER: {
    BANNER: '========================================',
    RUNNING_AT: (port: number) =>
      `  Server is running at: http://localhost:${port}`,
    LISTENING_ON: (host: string, port: number) =>
      `  Listening on: ${host}:${port}`,
    DATABASE: (database: string) => `  Database connected to: ${database}`,
    HEALTH_CHECK: (port: number) =>
      `  Health check: http://localhost:${port}/api/health`,
  },
} as const;

export const LOG_MESSAGES = {
  CONTROLLER: {
    HEALTH_GET_FAILED: 'GET /health failed',
  },
  FILTER: {
    CATCH_FAILED: 'HttpExceptionFilter.catch failed',
  },
  INTERCEPTOR: {
    MAP_FAILED: 'TransformInterceptor.map failed',
  },
  HTTP: {
    REQUEST: (
      method: string,
      url: string,
      status: number,
      ms: number,
      forwardedFor?: string,
    ) =>
      `${method} ${url} ${status} ${ms}ms` +
      (forwardedFor ? ` via ${forwardedFor}` : ''),
  },
} as const;
