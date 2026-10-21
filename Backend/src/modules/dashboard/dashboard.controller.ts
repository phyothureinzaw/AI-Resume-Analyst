import type { RequestHandler } from 'express';
import type { Pool } from 'pg';
import { createDashboardRepository } from './dashboard.repository.js';

export function dashboardController(pool: Pool): RequestHandler {
  const repo = createDashboardRepository(pool);
  return async (_req, res, next) => {
    try {
      const dashboard = await repo.get(res.locals.authUser.id as string);
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({ dashboard });
    } catch (error) { next(error); }
  };
}
