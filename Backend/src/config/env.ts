import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1),
  CORS_ORIGIN: z.string().url().default('http://localhost:5173'),
  BODY_LIMIT: z.string().default('1mb'),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  TRUST_PROXY: z.enum(['true', 'false']).default('false'),
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().min(1).default('gemini-3.5-flash-lite'),
  GEMINI_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(120_000).default(60_000),
  ANALYSIS_WORKER_POLL_MS: z.coerce.number().int().min(250).max(30_000).default(2_000),
  ANALYSIS_WORKER_LEASE_MS: z.coerce.number().int().min(30_000).max(300_000).default(90_000),
  ANALYSIS_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(5).default(3),
  ANALYSIS_MAX_ACTIVE_PER_USER: z.coerce.number().int().min(1).max(5).default(2),
  INTERVIEW_PREPARATION_MAX_ACTIVE_PER_USER: z.coerce.number().int().min(1).max(5).default(2),
});

export const env = (() => {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Invalid environment configuration. Check: ${fields}`);
  }
  return { ...parsed.data, TRUST_PROXY: parsed.data.TRUST_PROXY === 'true' };
})();
