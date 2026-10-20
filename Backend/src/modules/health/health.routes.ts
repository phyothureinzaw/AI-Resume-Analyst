import { Router } from 'express';
import { health, readiness, type HealthDatabase } from './health.controller.js';

export function healthRoutes(pool: HealthDatabase): Router {
  const router = Router();
  router.get('/', health);
  router.get('/ready', readiness(pool));
  return router;
}
