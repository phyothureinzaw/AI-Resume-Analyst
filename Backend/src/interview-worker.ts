import 'dotenv/config';
import { pool, closePool } from './db/pool.js';
import { createInterviewGeminiProvider } from './modules/interview-preparations/interview-preparation.gemini.js';
import { runInterviewPreparationWorker } from './modules/interview-preparations/interview-preparation.worker.js';

if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is required to start the interview preparation worker');
runInterviewPreparationWorker(pool, createInterviewGeminiProvider()).finally(() => closePool()).catch(() => { void closePool(); process.exitCode = 1; });
