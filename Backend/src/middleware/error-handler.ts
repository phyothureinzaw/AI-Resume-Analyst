import type { ErrorRequestHandler } from 'express';
import { AppError } from '../shared/errors/app-error.js';
import { logger } from '../shared/logger.js';

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const appError = error instanceof AppError ? error : new AppError(500, 'Internal server error', 'INTERNAL_ERROR');
  if (req.originalUrl.startsWith('/api/auth')) res.setHeader('Cache-Control', 'no-store');
  logger.error('request failed', { requestId: res.locals.requestId, method: req.method, path: req.path, error: error instanceof Error ? error.message : String(error) });
  res.status(appError.statusCode).json({ error: { code: appError.code, message: appError.statusCode === 500 ? 'Internal server error' : appError.message, requestId: res.locals.requestId } });
};
