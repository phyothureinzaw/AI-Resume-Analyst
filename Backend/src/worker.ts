import 'dotenv/config';
import { pool, closePool } from './db/pool.js';
import { createGeminiProvider } from './modules/analyses/gemini.provider.js';
import { runWorker } from './modules/analyses/analysis.worker.js';

if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is required to start the analysis worker');
const provider = createGeminiProvider();
runWorker(pool, provider).finally(() => closePool()).catch(() => { void closePool(); process.exitCode = 1; });
