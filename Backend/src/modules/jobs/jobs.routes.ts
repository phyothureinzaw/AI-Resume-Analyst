import { Router } from 'express';
import type { Pool } from 'pg';
import { authenticate, csrfProtection } from '../auth/auth.middleware.js';
import { jobsController } from './jobs.controller.js';

export function jobsRoutes(pool: Pool): Router {
  const router = Router();
  const controller = jobsController(pool);
  router.use(authenticate(pool));
  router.post('/', csrfProtection, controller.create);
  router.get('/', controller.list);
  router.get('/:id', controller.get);
  router.patch('/:id', csrfProtection, controller.update);
  router.delete('/:id', csrfProtection, controller.remove);
  return router;
}
