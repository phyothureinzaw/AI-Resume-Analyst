import pg from 'pg';
import { env } from '../config/env.js';

const { Pool } = pg;

export const pool = new Pool({ connectionString: env.DATABASE_URL, max: 10 });

export async function closePool(): Promise<void> {
  await pool.end();
}
