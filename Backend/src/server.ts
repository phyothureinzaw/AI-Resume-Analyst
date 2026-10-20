import { createServer } from 'node:http';
import { env } from './config/env.js';
import { pool, closePool } from './db/pool.js';
import { logger } from './shared/logger.js';
import { createApp } from './app.js';

const server = createServer(createApp(pool));
server.listen(env.PORT, () => logger.info('server listening', { port: env.PORT }));

async function shutdown(signal: string): Promise<void> {
  logger.info('shutdown started', { signal });
  server.close(async (error) => {
    if (error) logger.error('http server close failed', { error: error.message });
    await closePool();
    process.exit(error ? 1 : 0);
  });
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
