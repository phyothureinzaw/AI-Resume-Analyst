import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import type { Pool } from 'pg';
import { authenticate, csrfProtection } from '../auth/auth.middleware.js';
import { analysesController } from './analysis.controller.js';

export function analysesRoutes(pool: Pool): Router {
  const router = Router(); const controller = analysesController(pool);
  router.use(authenticate(pool));
  router.post('/', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false }), csrfProtection, controller.create);
  router.get('/', controller.list); router.get('/:id', controller.get);
  return router;
}
