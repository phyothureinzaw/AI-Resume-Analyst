import type { RequestHandler } from 'express';
import { AppError } from '../../shared/errors/app-error.js';

export type HealthDatabase = { query: (sql: string) => Promise<unknown> };

export const health: RequestHandler = (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'ai-resume-platform-backend' });
};

export function readiness(pool: HealthDatabase): RequestHandler {
  return async (_req, res, next) => {
    try {
      await pool.query('SELECT 1');
      res.status(200).json({ status: 'ready', database: 'available' });
    } catch {
      next(new AppError(503, 'Database unavailable', 'DATABASE_UNAVAILABLE'));
    }
  };
}
