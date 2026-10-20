import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1),
  CORS_ORIGIN: z.string().url().default('http://localhost:5173'),
  BODY_LIMIT: z.string().default('1mb'),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  TRUST_PROXY: z.enum(['true', 'false']).default('false')
});

export const env = (() => {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Invalid environment configuration. Check: ${fields}`);
  }
  return { ...parsed.data, TRUST_PROXY: parsed.data.TRUST_PROXY === 'true' };
})();
