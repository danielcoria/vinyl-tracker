import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { ApiError } from '@vinyl/shared';
import { ZodError } from 'zod';
import { AppError, NotFoundError } from '../errors.js';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`No route for ${req.method} ${req.baseUrl}${req.path}`));
};

/** express.json() rejects malformed bodies with this error type. */
function isBodyParseError(err: unknown): boolean {
  return (
    typeof err === 'object' && err !== null && 'type' in err && err.type === 'entity.parse.failed'
  );
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  let status = 500;
  let body: ApiError = { error: { code: 'INTERNAL', message: 'Something went wrong' } };

  if (err instanceof AppError) {
    status = err.status;
    body = { error: { code: err.code, message: err.message } };
  } else if (err instanceof ZodError) {
    status = 400;
    const message = err.issues
      .map((issue) =>
        issue.path.length > 0 ? `${issue.path.join('.')}: ${issue.message}` : issue.message,
      )
      .join('; ');
    body = { error: { code: 'VALIDATION', message } };
  } else if (isBodyParseError(err)) {
    status = 400;
    body = { error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' } };
  } else {
    console.error(err);
  }

  res.status(status).json(body);
};
