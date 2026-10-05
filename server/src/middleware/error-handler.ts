import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { ApiError } from '@vinyl/shared';
import { ZodError } from 'zod';
import { AppError, NotFoundError } from '../errors.js';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`No route for ${req.method} ${req.baseUrl}${req.path}`));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  let status = 500;
  let body: ApiError = { error: { code: 'INTERNAL', message: 'Something went wrong' } };

  if (err instanceof AppError) {
    status = err.status;
    body = { error: { code: err.code, message: err.message } };
  } else if (err instanceof ZodError) {
    status = 400;
    body = { error: { code: 'VALIDATION', message: err.issues.map((i) => i.message).join('; ') } };
  } else {
    console.error(err);
  }

  res.status(status).json(body);
};
