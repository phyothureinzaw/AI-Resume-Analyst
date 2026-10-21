import { env } from '../../config/env.js';
import { logger } from '../../shared/logger.js';
import { createAnalysisRepository } from './analysis.repository.js';
import { GeminiProviderError, type GeminiProvider } from './gemini.provider.js';
import { AnalysisProcessingError, hasIdentifiableRequirements, parseProviderResult } from './analysis.service.js';
import { MAX_DOCUMENT_TEXT_LENGTH } from '../../shared/content-limits.js';
import type { Pool } from 'pg';

const transientKinds = new Set(['transient', 'rate_limited']);
function retryDelay(attempt: number): number { return Math.min(30_000, 1_000 * (2 ** Math.max(0, attempt - 1)) + Math.floor(Math.random() * 500)); }
type FailureStage = 'queue_claim' | 'input_validation' | 'gemini_request' | 'json_parse' | 'schema_validation' | 'evidence_validation' | 'scoring' | 'database_completion' | 'failure_persistence' | 'worker_loop';
function safeErrorCode(error: unknown): string { if (error instanceof GeminiProviderError) return `GEMINI_${error.kind.toUpperCase()}`; if (error instanceof AnalysisProcessingError) return error.code; return 'ANALYSIS_FAILED'; }
function safeExceptionName(error: unknown): string { const name = error instanceof Error ? error.name : 'UnknownError'; return /^[A-Za-z][A-Za-z0-9_]*$/.test(name) ? name : 'Error'; }
function databaseDetails(error: unknown): { postgresCode?: string; postgresConstraint?: string } { const value = error as { code?: unknown; constraint?: unknown }; const code = typeof value?.code === 'string' && /^[0-9A-Z]{5}$/.test(value.code) ? value.code : undefined; const constraint = code && typeof value?.constraint === 'string' && /^[A-Za-z0-9_]+$/.test(value.constraint) ? value.constraint : undefined; return { ...(code ? { postgresCode: code } : {}), ...(constraint ? { postgresConstraint: constraint } : {}) }; }
function failureDiagnostics(error: unknown, stage: FailureStage): Record<string, unknown> {
  const processing = error instanceof AnalysisProcessingError ? { validationFieldPaths: error.fieldPaths, validationIssues: error.validationIssues, evidenceIssues: error.evidenceIssues } : {};
  const provider = error instanceof GeminiProviderError ? { providerHttpStatus: error.details.httpStatus, providerStatus: error.details.providerStatus, providerMessage: error.details.providerMessage, requestDurationMs: error.details.requestDurationMs, inputChars: error.details.inputChars } : {};
  return { stage, exceptionName: safeExceptionName(error), safeErrorCode: safeErrorCode(error), ...processing, ...provider, ...databaseDetails(error) };
}

export async function processOne(pool: Pool, provider: GeminiProvider): Promise<boolean> {
  const repo = createAnalysisRepository(pool); const row = await repo.claimNext(env.ANALYSIS_WORKER_LEASE_MS); if (!row) return false;
  const claimToken = row.claim_token!; const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), env.GEMINI_TIMEOUT_MS);
  let stage: FailureStage = 'input_validation';
  let responseDiagnostics: Record<string, unknown> = {};
  let normalizationDiagnostics: Record<string, unknown> = {};
  const inputDiagnostics = { inputChars: { resume: row.resume_text_snapshot.length, job: row.job_text_snapshot.length } };
  try {
    if (!row.resume_text_snapshot.trim() || !row.job_text_snapshot.trim()) throw new AnalysisProcessingError('input_validation', 'ANALYSIS_INPUT_UNUSABLE', [], [], 'The saved analysis inputs do not contain usable text');
    if (row.resume_text_snapshot.length > MAX_DOCUMENT_TEXT_LENGTH || row.job_text_snapshot.length > MAX_DOCUMENT_TEXT_LENGTH) throw new AnalysisProcessingError('input_validation', 'ANALYSIS_INPUT_TOO_LARGE', [], [], 'The saved analysis inputs exceed the supported limit');
    if (!hasIdentifiableRequirements(row.job_text_snapshot)) throw new AnalysisProcessingError('input_validation', 'ANALYSIS_NO_REQUIREMENTS', [], [], 'No identifiable job requirements were found');
    stage = 'gemini_request';
    const response = await provider.generateAnalysis(row.resume_text_snapshot, row.job_text_snapshot, controller.signal);
    responseDiagnostics = response.diagnostics;
    stage = 'json_parse';
    const parsed = parseProviderResult(response.text, row.resume_text_snapshot, row.job_text_snapshot);
    normalizationDiagnostics = parsed.normalization;
    stage = 'database_completion';
    const completed = await repo.complete(row.id, claimToken, parsed.result, parsed.score, response.modelName ?? env.GEMINI_MODEL);
    if (!completed) throw new AnalysisProcessingError('database_completion', 'ANALYSIS_COMPLETION_LOST');
    logger.info('analysis completed', { analysisId: row.id, attempt: row.attempt_count, model: response.modelName ?? env.GEMINI_MODEL, ...response.diagnostics, ...normalizationDiagnostics });
  } catch (error) {
    const code = safeErrorCode(error); const kind = error instanceof GeminiProviderError ? error.kind : 'invalid_output';
    const failureStage = error instanceof AnalysisProcessingError ? error.stage : stage;
    try {
      if (transientKinds.has(kind) && row.attempt_count < env.ANALYSIS_MAX_ATTEMPTS) await repo.retry(row.id, claimToken, code, retryDelay(row.attempt_count), env.ANALYSIS_MAX_ATTEMPTS);
      else await repo.fail(row.id, claimToken, code);
    } catch (persistenceError) {
      logger.error('analysis failure persistence failed', { analysisId: row.id, attempt: row.attempt_count, ...failureDiagnostics(persistenceError, 'failure_persistence') });
    }
    logger.error('analysis attempt failed', { analysisId: row.id, attempt: row.attempt_count, ...inputDiagnostics, ...responseDiagnostics, ...normalizationDiagnostics, ...failureDiagnostics(error, failureStage) });
  } finally { clearTimeout(timeout); }
  return true;
}

export async function runWorker(pool: Pool, provider: GeminiProvider): Promise<void> {
  let stopping = false; const stop = () => { stopping = true; };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  logger.info('analysis worker started', { pollMs: env.ANALYSIS_WORKER_POLL_MS, model: env.GEMINI_MODEL });
  while (!stopping) { try { const worked = await processOne(pool, provider); if (!worked) await new Promise((resolve) => setTimeout(resolve, env.ANALYSIS_WORKER_POLL_MS)); } catch (error) { logger.error('analysis worker loop failed', failureDiagnostics(error, 'queue_claim')); await new Promise((resolve) => setTimeout(resolve, env.ANALYSIS_WORKER_POLL_MS)); } }
  logger.info('analysis worker stopped');
}
