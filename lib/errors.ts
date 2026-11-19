export const ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "ENTITY_IN_USE",
  "DUPLICATE_CONTACT",
  "PAYLOAD_TOO_LARGE",
  "RATE_LIMITED",
  "AI_NOT_CONFIGURED",
  "AI_PROVIDER_ERROR",
  "AI_TIMEOUT",
  "AI_INVALID_RESPONSE",
  "INVALID_SIGNATURE",
  "STALE_TIMESTAMP",
  "INTERNAL_ERROR",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  ENTITY_IN_USE: 409,
  DUPLICATE_CONTACT: 409,
  PAYLOAD_TOO_LARGE: 413,
  RATE_LIMITED: 429,
  AI_NOT_CONFIGURED: 503,
  AI_PROVIDER_ERROR: 502,
  AI_TIMEOUT: 504,
  AI_INVALID_RESPONSE: 502,
  INVALID_SIGNATURE: 401,
  STALE_TIMESTAMP: 401,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(
    code: ErrorCode,
    message: string,
    options?: { status?: number; details?: unknown; cause?: unknown },
  ) {
    super(message, { cause: options?.cause });
    this.name = "AppError";
    this.code = code;
    this.status = options?.status ?? STATUS_BY_CODE[code];
    this.details = options?.details;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function statusForCode(code: ErrorCode): number {
  return STATUS_BY_CODE[code];
}
