import type { Pool } from 'pg';
import { env } from '../../config/env.js';
import { logger } from '../../shared/logger.js';
import { GeminiProviderError, type GeminiFailureKind } from '../analyses/gemini.provider.js';
import { createInterviewGeminiProvider, type InterviewGeminiProvider } from './interview-preparation.gemini.js';
import { InterviewInputValidationError, InterviewResultValidationError, validateInterviewSnapshots, validateInterviewPreparationResult, validationIssuePaths, type InterviewInputDiagnostics, type InterviewValidationIssue } from './interview-preparation.result.js';
import { createInterviewPreparationRepository } from './interview-preparation.repository.js';
import type { InterviewPreparationRow } from './interview-preparation.types.js';

const transientKinds = new Set<GeminiFailureKind>(['transient', 'rate_limited']);
const maxAttempts = env.ANALYSIS_MAX_ATTEMPTS;
function retryDelay(attempt: number): number { return Math.min(30_000, 1_000 * (2 ** Math.max(0, attempt - 1)) + Math.floor(Math.random() * 500)); }
type Stage = 'input_validation' | 'gemini_request' | 'json_parse' | 'schema_validation' | 'database_completion' | 'failure_persistence' | 'queue_claim';
function safeCode(error: unknown, stage: Stage): string { if (error instanceof GeminiProviderError) return `GEMINI_${error.kind.toUpperCase()}`; if (error instanceof InterviewInputValidationError) return 'INTERVIEW_INPUT_INVALID'; return stage === 'json_parse' ? 'INTERVIEW_INVALID_JSON' : stage === 'schema_validation' ? 'INTERVIEW_SCHEMA_INVALID' : stage === 'database_completion' ? 'INTERVIEW_COMPLETION_LOST' : stage === 'queue_claim' ? 'INTERVIEW_QUEUE_FAILED' : stage === 'failure_persistence' ? 'INTERVIEW_FAILURE_PERSISTENCE_FAILED' : 'INTERVIEW_PREPARATION_FAILED'; }
function diagnostics(error: unknown, stage: Stage, input?: InterviewInputDiagnostics): Record<string, unknown> {
  const provider = error instanceof GeminiProviderError ? { providerHttpStatus: error.details.httpStatus, providerStatus: error.details.providerStatus, providerMessage: error.details.providerMessage, requestDurationMs: error.details.requestDurationMs, inputChars: error.details.inputChars } : {};
  const fieldPaths = error instanceof Error && 'fieldPaths' in error && Array.isArray((error as Error & { fieldPaths?: unknown }).fieldPaths) ? (error as Error & { fieldPaths: string[] }).fieldPaths : validationIssuePaths(error);
  const validationIssues = error instanceof InterviewResultValidationError ? error.issues : undefined;
  const inputFailure = error instanceof InterviewInputValidationError ? error.diagnostics : null;
  return { stage, exceptionName: error instanceof Error && /^[A-Za-z][A-Za-z0-9_]*$/.test(error.name) ? error.name : 'Error', safeErrorCode: safeCode(error, stage), ...(inputFailure ? { validationReasonCode: inputFailure.reasonCode, validationFieldPath: inputFailure.fieldPath, expectedType: inputFailure.expectedType, receivedType: inputFailure.receivedType, inputChars: inputFailure.inputChars, segmentCounts: inputFailure.segmentCounts } : input ? { inputChars: input.inputChars, segmentCounts: input.segmentCounts } : {}), validationFieldPaths: fieldPaths, ...(validationIssues ? { validationIssues } : {}), ...provider };
}
function parseAndValidate(text: string, row: InterviewPreparationRow) {
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error('invalid JSON'); }
  const { segments } = validateInterviewSnapshots({ jobText: row.job_text_snapshot, resumeId: row.resume_id, resumeText: row.resume_text_snapshot });
  try { return validateInterviewPreparationResult(value, segments, Boolean(row.resume_id)); } catch (error) { if (error instanceof InterviewResultValidationError) throw error; const wrapped = new Error('interview result schema validation failed'); wrapped.name = 'InterviewResultValidationError'; (wrapped as Error & { fieldPaths?: string[]; issues?: InterviewValidationIssue[] }).fieldPaths = validationIssuePaths(error); throw wrapped; }
}

export async function processInterviewPreparationOne(pool: Pool, provider: InterviewGeminiProvider): Promise<boolean> {
  const repo = createInterviewPreparationRepository(pool);
  const row = await repo.claimNext(env.ANALYSIS_WORKER_LEASE_MS);
  if (!row) return false;
  const claimToken = row.claim_token!;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.GEMINI_TIMEOUT_MS);
  let stage: Stage = 'input_validation';
  let inputDiagnostics: InterviewInputDiagnostics | undefined;
  try {
    const validated = validateInterviewSnapshots({ jobText: row.job_text_snapshot, resumeId: row.resume_id, resumeText: row.resume_text_snapshot });
    inputDiagnostics = validated.diagnostics;
    const segments = validated.segments;
    stage = 'gemini_request';
    const response = await provider.generate(row.job_title_snapshot, row.company_name_snapshot, row.job_text_snapshot, row.resume_text_snapshot, segments, controller.signal);
    if (response.diagnostics.outputTruncated) throw new GeminiProviderError('invalid_output', 'interview output truncated', { httpStatus: null, providerStatus: 'TRUNCATED', providerMessage: null });
    stage = 'json_parse';
    let result: ReturnType<typeof parseAndValidate>;
    try { result = parseAndValidate(response.text, row); } catch (error) { stage = error instanceof Error && error.message === 'invalid JSON' ? 'json_parse' : 'schema_validation'; throw error; }
    stage = 'database_completion';
    if (!await repo.complete(row.id, claimToken, result, response.modelName ?? env.GEMINI_MODEL)) throw new Error('active claim was lost before completion');
    logger.info('interview preparation completed', { preparationId: row.id, attempt: row.attempt_count, model: response.modelName ?? env.GEMINI_MODEL, ...response.diagnostics });
  } catch (error) {
    const kind = error instanceof GeminiProviderError ? error.kind : 'invalid_output';
    const code = safeCode(error, stage);
    try { if (transientKinds.has(kind) && row.attempt_count < maxAttempts) await repo.retry(row.id, claimToken, code, retryDelay(row.attempt_count), maxAttempts); else await repo.fail(row.id, claimToken, code); } catch (persistenceError) { logger.error('interview preparation failure persistence failed', { preparationId: row.id, attempt: row.attempt_count, ...diagnostics(persistenceError, 'failure_persistence') }); }
    logger.error('interview preparation attempt failed', { preparationId: row.id, attempt: row.attempt_count, ...diagnostics(error, stage, inputDiagnostics) });
  } finally { clearTimeout(timeout); }
  return true;
}

export async function runInterviewPreparationWorker(pool: Pool, provider: InterviewGeminiProvider = createInterviewGeminiProvider()): Promise<void> {
  let stopping = false;
  const stop = () => { stopping = true; };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  logger.info('interview preparation worker started', { pollMs: env.ANALYSIS_WORKER_POLL_MS, model: env.GEMINI_MODEL });
  while (!stopping) { try { const worked = await processInterviewPreparationOne(pool, provider); if (!worked) await new Promise((resolve) => setTimeout(resolve, env.ANALYSIS_WORKER_POLL_MS)); } catch (error) { logger.error('interview preparation worker loop failed', { ...diagnostics(error, 'queue_claim') }); await new Promise((resolve) => setTimeout(resolve, env.ANALYSIS_WORKER_POLL_MS)); } }
  logger.info('interview preparation worker stopped');
}

export function classifyInterviewWorkerFailure(error: unknown, stage: Stage): Record<string, unknown> { return diagnostics(error, stage); }
