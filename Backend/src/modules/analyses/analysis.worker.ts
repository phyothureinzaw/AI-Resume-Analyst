import { env } from '../../config/env.js';
import { logger } from '../../shared/logger.js';
import { createAnalysisRepository } from './analysis.repository.js';
import { GeminiProviderError, type GeminiProvider } from './gemini.provider.js';
import { parseProviderResult } from './analysis.service.js';
import type { Pool } from 'pg';

const transientKinds = new Set(['transient', 'rate_limited']);
function retryDelay(attempt: number): number { return Math.min(30_000, 1_000 * (2 ** Math.max(0, attempt - 1)) + Math.floor(Math.random() * 500)); }
function safeErrorCode(error: unknown): string { if (error instanceof GeminiProviderError) return `GEMINI_${error.kind.toUpperCase()}`; return 'ANALYSIS_FAILED'; }

export async function processOne(pool: Pool, provider: GeminiProvider): Promise<boolean> {
  const repo = createAnalysisRepository(pool); const row = await repo.claimNext(env.ANALYSIS_WORKER_LEASE_MS); if (!row) return false;
  const claimToken = row.claim_token!; const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), env.GEMINI_TIMEOUT_MS);
  try {
    const response = await provider.generateAnalysis(row.resume_text_snapshot, row.job_text_snapshot, controller.signal);
    const parsed = parseProviderResult(response.text, row.resume_text_snapshot, row.job_text_snapshot);
    await repo.complete(row.id, claimToken, parsed.result, parsed.score, response.modelName ?? env.GEMINI_MODEL);
    logger.info('analysis completed', { analysisId: row.id, attempt: row.attempt_count, model: response.modelName ?? env.GEMINI_MODEL });
  } catch (error) {
    const code = safeErrorCode(error); const kind = error instanceof GeminiProviderError ? error.kind : 'invalid_output';
    if (transientKinds.has(kind) && row.attempt_count < env.ANALYSIS_MAX_ATTEMPTS) await repo.retry(row.id, claimToken, code, retryDelay(row.attempt_count), env.ANALYSIS_MAX_ATTEMPTS);
    else await repo.fail(row.id, claimToken, code);
    const providerDetails = error instanceof GeminiProviderError ? { providerHttpStatus: error.details.httpStatus, providerStatus: error.details.providerStatus, providerMessage: error.details.providerMessage } : {};
    logger.error('analysis attempt failed', { analysisId: row.id, attempt: row.attempt_count, errorCode: code, ...providerDetails });
  } finally { clearTimeout(timeout); }
  return true;
}

export async function runWorker(pool: Pool, provider: GeminiProvider): Promise<void> {
  let stopping = false; const stop = () => { stopping = true; };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  logger.info('analysis worker started', { pollMs: env.ANALYSIS_WORKER_POLL_MS, model: env.GEMINI_MODEL });
  while (!stopping) { try { const worked = await processOne(pool, provider); if (!worked) await new Promise((resolve) => setTimeout(resolve, env.ANALYSIS_WORKER_POLL_MS)); } catch (error) { logger.error('analysis worker loop failed', { error: error instanceof Error ? error.message : 'unknown' }); await new Promise((resolve) => setTimeout(resolve, env.ANALYSIS_WORKER_POLL_MS)); } }
  logger.info('analysis worker stopped');
}
