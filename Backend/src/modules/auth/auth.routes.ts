import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { Pool } from 'pg';
import { authenticate } from './auth.middleware.js';
import { authController } from './auth.controller.js';

export function authRoutes(pool: Pick<Pool, 'query'>): Router {
  const router = Router();
  const controller = authController(pool);
  const authRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      res.status(429).json({ error: { code: 'AUTH_RATE_LIMITED', message: 'Too many authentication attempts', requestId: res.locals.requestId } });
    }
  });
  router.get('/csrf', controller.csrf);
  router.post('/register', authRateLimit, controller.csrfProtection, controller.register);
  router.post('/login', authRateLimit, controller.csrfProtection, controller.login);
  router.post('/logout', controller.csrfProtection, controller.logout);
  router.get('/me', authenticate(pool), controller.me);
  return router;
}
