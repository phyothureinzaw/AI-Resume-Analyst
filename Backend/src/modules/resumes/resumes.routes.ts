import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { Pool } from 'pg';
import { authenticate } from '../auth/auth.middleware.js';
import { csrfProtection } from '../auth/auth.middleware.js';
import { resumeController } from './resumes.controller.js';

export function resumeRoutes(pool: Pool): Router {
  const router = Router();
  const controller = resumeController(pool);
  const extractionRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, handler: (_req, res) => { res.setHeader('Cache-Control', 'no-store'); res.status(429).json({ error: { code: 'PDF_RATE_LIMITED', message: 'Too many PDF extraction attempts', requestId: res.locals.requestId } }); } });
  router.use(authenticate(pool));
  router.post('/extract', extractionRateLimit, csrfProtection, controller.extract);
  router.post('/', csrfProtection, controller.create);
  router.get('/', controller.list);
  router.get('/:id', controller.get);
  router.patch('/:id', csrfProtection, controller.update);
  router.delete('/:id', csrfProtection, controller.remove);
  return router;
}
