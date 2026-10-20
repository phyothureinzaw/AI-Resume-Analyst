import type { RequestHandler } from 'express';
import { AppError } from '../shared/errors/app-error.js';

export const notFound: RequestHandler = (req) => {
  throw new AppError(404, `Route not found: ${req.method} ${req.path}`, 'NOT_FOUND');
};
