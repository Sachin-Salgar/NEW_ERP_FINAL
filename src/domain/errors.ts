export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly expose: boolean;
  public readonly details?: unknown;

  constructor(message: string, code = 'APP_ERROR', statusCode = 500, expose = true, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.expose = expose;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', 400, true, details);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', details?: unknown) {
    super(message, 'UNAUTHORIZED', 401, true, details);
    this.name = 'UnauthorizedError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'NOT_FOUND', 404, true, details);
    this.name = 'NotFoundError';
  }
}

export class TenantContextError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'TENANT_CONTEXT_ERROR', 400, true, details);
    this.name = 'TenantContextError';
  }
}
