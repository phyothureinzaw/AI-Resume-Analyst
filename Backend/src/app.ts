import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFound } from './middleware/not-found.js';
import { requestId } from './middleware/request-id.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import type { Pool } from 'pg';
import { resumeRoutes } from './modules/resumes/resumes.routes.js';
import { jobsRoutes } from './modules/jobs/jobs.routes.js';
import { analysesRoutes } from './modules/analyses/analysis.routes.js';

export function createApp(databasePool: Pick<Pool, 'query'>) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);
  app.use(requestId);
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: env.BODY_LIMIT }));
  app.use('/api/health', healthRoutes(databasePool));
  app.use('/api/auth', authRoutes(databasePool));
  app.use('/api/resumes', resumeRoutes(databasePool as Pool));
  app.use('/api/jobs', jobsRoutes(databasePool as Pool));
  app.use('/api/analyses', analysesRoutes(databasePool as Pool));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
