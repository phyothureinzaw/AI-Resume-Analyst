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
const unexpectedStageCodes: Record<FailureStage, string> = { queue_claim: 'ANALYSIS_QUEUE_FAILED', input_validation: 'ANALYSIS_INPUT_FAILED', gemini_request: 'ANALYSIS_PROVIDER_FAILED', json_parse: 'ANALYSIS_JSON_PARSE_FAILED', schema_validation: 'ANALYSIS_SCHEMA_STAGE_FAILED', evidence_validation: 'ANALYSIS_EVIDENCE_STAGE_FAILED', scoring: 'ANALYSIS_SCORING_STAGE_FAILED', database_completion: 'ANALYSIS_DATABASE_COMPLETION_FAILED', failure_persistence: 'ANALYSIS_FAILURE_PERSISTENCE_FAILED', worker_loop: 'ANALYSIS_WORKER_LOOP_FAILED' };
function safeErrorCode(error: unknown, stage: FailureStage): string { if (error instanceof GeminiProviderError) return `GEMINI_${error.kind.toUpperCase()}`; if (error instanceof AnalysisProcessingError) return error.code; return unexpectedStageCodes[stage]; }
function safeExceptionName(error: unknown): string { const name = error instanceof Error ? error.name : 'UnknownError'; return /^[A-Za-z][A-Za-z0-9_]*$/.test(name) ? name : 'Error'; }
function safeExceptionMessage(error: unknown): string | undefined {
  if (!(error instanceof Error) || !error.message) return undefined;
  return error.message.replace(/https?:\/\/\S+/gi, '[url redacted]').replace(/(api[_ -]?key|token|password|cookie|authorization)\s*[:=]\s*\S+/gi, '$1=[redacted]').replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[email redacted]').replace(/(['"])(?:(?!\1).){20,}\1/g, '$1[content redacted]$1').replace(/\s+/g, ' ').slice(0, 300);
}
function databaseDetails(error: unknown): { postgresCode?: string; postgresConstraint?: string } { const value = error as { code?: unknown; constraint?: unknown }; const code = typeof value?.code === 'string' && /^[0-9A-Z]{5}$/.test(value.code) ? value.code : undefined; const constraint = code && typeof value?.constraint === 'string' && /^[A-Za-z0-9_]+$/.test(value.constraint) ? value.constraint : undefined; return { ...(code ? { postgresCode: code } : {}), ...(constraint ? { postgresConstraint: constraint } : {}) }; }
function failureDiagnostics(error: unknown, stage: FailureStage): Record<string, unknown> {
  const processing = error instanceof AnalysisProcessingError ? { validationFieldPaths: error.fieldPaths, validationIssues: error.validationIssues, evidenceIssues: error.evidenceIssues } : {};
  const provider = error instanceof GeminiProviderError ? { providerHttpStatus: error.details.httpStatus, providerStatus: error.details.providerStatus, providerMessage: error.details.providerMessage, requestDurationMs: error.details.requestDurationMs, inputChars: error.details.inputChars } : {};
  const exceptionMessage = safeExceptionMessage(error);
  return { stage, exceptionName: safeExceptionName(error), ...(exceptionMessage ? { exceptionMessage } : {}), safeErrorCode: safeErrorCode(error, stage), ...processing, ...provider, ...databaseDetails(error) };
}
export function classifyWorkerFailure(error: unknown, stage: FailureStage): Record<string, unknown> { return failureDiagnostics(error, stage); }

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
    const failureStage = error instanceof AnalysisProcessingError ? error.stage : stage;
    const code = safeErrorCode(error, failureStage); const kind = error instanceof GeminiProviderError ? error.kind : 'invalid_output';
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
