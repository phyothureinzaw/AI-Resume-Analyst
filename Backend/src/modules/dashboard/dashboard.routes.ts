import { Router } from 'express';
import type { Pool } from 'pg';
import { authenticate } from '../auth/auth.middleware.js';
import { dashboardController } from './dashboard.controller.js';

export function dashboardRoutes(pool: Pool): Router {
  const router = Router();
  router.use(authenticate(pool));
  router.get('/', dashboardController(pool));
  return router;
}
