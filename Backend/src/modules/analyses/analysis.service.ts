import { ZodError } from 'zod';
import { analysisCreateSchema, analysisListSchema, analysisProviderResultSchema, analysisResultSchema, MAX_RESUME_EVIDENCE_EXCERPTS } from './analysis.schema.js';
import type { AnalysisResult, AnalysisRow } from './analysis.types.js';
import { EvidenceValidationError, validateEvidence } from './evidence.js';
import type { EvidenceValidationIssue } from './evidence.js';
import { scoreAnalysis } from './scoring.js';
import { AppError } from '../../shared/errors/app-error.js';

export const PROMPT_VERSION = 'resume-job-v1';
export type AnalysisFailureStage = 'input_validation' | 'json_parse' | 'schema_validation' | 'evidence_validation' | 'scoring' | 'database_completion';
export type AnalysisValidationIssue = { code: string; path: string; expected?: string; received?: string; minimum?: number; maximum?: number; evidenceStatus?: string };
export type AnalysisNormalizationDiagnostics = { overflowRequirementCount: number; inputExcerptCount: number; deduplicatedExcerptCount: number; truncatedExcerptCount: number };
export class AnalysisProcessingError extends AppError {
  constructor(public readonly stage: AnalysisFailureStage, code: string, public readonly fieldPaths: string[] = [], public readonly validationIssues: AnalysisValidationIssue[] = [], message = 'Analysis provider returned unsupported output', public readonly evidenceIssues: EvidenceValidationIssue[] = []) {
    super(502, message, code);
    this.name = 'AnalysisProcessingError';
  }
}
export function validateCreate(value: unknown) { return analysisCreateSchema.parse(value); }
export function validateList(value: unknown) { return analysisListSchema.parse(value); }
export function validateId(value: unknown): string { const result = String((value as { id?: unknown }).id ?? ''); if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result)) throw new AppError(400, 'Invalid analysis id', 'VALIDATION_ERROR'); return result; }
const requirementCue = /\b(?:required|must|minimum|qualification\w*|responsibilit\w*|skill\w*|experience|ability|proficien\w*|knowledge|preferred|manage\w*|develop\w*|design\w*|build\w*|analy[sz]\w*|coordinate\w*|certif\w*|degree\w*|license\w*|\d+\s+years?)\b/i;
export function hasIdentifiableRequirements(jobText: string): boolean { return requirementCue.test(jobText); }
function evidenceStatusAt(value: unknown, path: (string | number)[]): string | undefined {
  if (path[0] !== 'requirements' || typeof path[1] !== 'number') return undefined;
  if (typeof value !== 'object' || value === null || !('requirements' in value)) return undefined;
  const requirements = (value as { requirements?: unknown }).requirements;
  if (!Array.isArray(requirements)) return undefined;
  const item = requirements[path[1]];
  if (typeof item !== 'object' || item === null || !('evidenceStatus' in item)) return undefined;
  const status = (item as { evidenceStatus?: unknown }).evidenceStatus;
  return typeof status === 'string' ? status : undefined;
}
function validationIssueMetadata(error: ZodError, parsed: unknown): AnalysisValidationIssue[] {
  return error.issues.map((issue) => {
    const metadata: AnalysisValidationIssue = { code: issue.code, path: issue.path.join('.') };
    if ('expected' in issue && typeof issue.expected === 'string') metadata.expected = issue.expected;
    if ('received' in issue && typeof issue.received === 'string') metadata.received = issue.received;
    if ('minimum' in issue && typeof issue.minimum === 'number') metadata.minimum = issue.minimum;
    if ('maximum' in issue && typeof issue.maximum === 'number') metadata.maximum = issue.maximum;
    const evidenceStatus = evidenceStatusAt(parsed, issue.path);
    if (evidenceStatus) metadata.evidenceStatus = evidenceStatus;
    return metadata;
  }).filter((issue) => issue.path);
}
function normalizeVerifiedEvidence(result: AnalysisResult): { result: AnalysisResult; diagnostics: AnalysisNormalizationDiagnostics } {
  const diagnostics: AnalysisNormalizationDiagnostics = { overflowRequirementCount: 0, inputExcerptCount: 0, deduplicatedExcerptCount: 0, truncatedExcerptCount: 0 };
  const requirements = result.requirements.map((requirement) => {
    diagnostics.inputExcerptCount += requirement.resumeEvidenceExcerpts.length;
    if (requirement.resumeEvidenceExcerpts.length > MAX_RESUME_EVIDENCE_EXCERPTS) diagnostics.overflowRequirementCount += 1;
    const seen = new Set<string>();
    const excerpts = requirement.resumeEvidenceExcerpts.filter((excerpt) => {
      const key = excerpt.replace(/\s+/g, ' ').trim();
      if (seen.has(key)) { diagnostics.deduplicatedExcerptCount += 1; return false; }
      seen.add(key);
      return true;
    }).slice(0, MAX_RESUME_EVIDENCE_EXCERPTS);
    diagnostics.truncatedExcerptCount += Math.max(0, seen.size - MAX_RESUME_EVIDENCE_EXCERPTS);
    if (excerpts.length === requirement.resumeEvidenceExcerpts.length) return requirement;
    return { ...requirement, resumeEvidenceExcerpts: excerpts };
  });
  return { result: { ...result, requirements }, diagnostics };
}
export function parseProviderResult(text: string, resumeSnapshot: string, jobSnapshot: string): { result: AnalysisResult; score: number; normalization: AnalysisNormalizationDiagnostics } {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new AnalysisProcessingError('json_parse', 'ANALYSIS_INVALID_JSON', [], [], 'Analysis provider returned invalid output'); }
  let result: AnalysisResult;
  try { result = analysisResultSchema.parse(parsed); } catch {
    try { result = analysisProviderResultSchema.parse(parsed); } catch (providerError) {
      if (providerError instanceof ZodError) {
        const validationIssues = validationIssueMetadata(providerError, parsed);
        throw new AnalysisProcessingError('schema_validation', 'ANALYSIS_SCHEMA_INVALID', validationIssues.map((issue) => issue.path), validationIssues);
      }
      throw new AnalysisProcessingError('schema_validation', 'ANALYSIS_SCHEMA_INVALID');
    }
  }
  if (result.requirements.length === 0) throw new AnalysisProcessingError('schema_validation', 'ANALYSIS_NO_REQUIREMENTS', [], [], 'No identifiable job requirements were found');
  try { validateEvidence(result, resumeSnapshot, jobSnapshot); } catch (error) {
    if (error instanceof EvidenceValidationError) throw new AnalysisProcessingError('evidence_validation', 'ANALYSIS_EVIDENCE_INVALID', [], [], 'Analysis evidence did not match source snapshots', error.issues);
    throw new AnalysisProcessingError('evidence_validation', 'ANALYSIS_EVIDENCE_INVALID');
  }
  const normalized = normalizeVerifiedEvidence(result);
  try { result = analysisResultSchema.parse(normalized.result); } catch (finalError) {
    const validationIssues = finalError instanceof ZodError ? validationIssueMetadata(finalError, normalized.result) : [];
    throw new AnalysisProcessingError('schema_validation', 'ANALYSIS_SCHEMA_INVALID', validationIssues.map((issue) => issue.path), validationIssues);
  }
  try { validateEvidence(result, resumeSnapshot, jobSnapshot); } catch (error) {
    if (error instanceof EvidenceValidationError) throw new AnalysisProcessingError('evidence_validation', 'ANALYSIS_EVIDENCE_INVALID', [], [], 'Analysis evidence did not match source snapshots', error.issues);
    throw new AnalysisProcessingError('evidence_validation', 'ANALYSIS_EVIDENCE_INVALID');
  }
  try { return { result, score: scoreAnalysis(result), normalization: normalized.diagnostics }; } catch { throw new AnalysisProcessingError('scoring', 'ANALYSIS_SCORING_FAILED'); }
}
export function toSummary(row: { id: string; resume_id: string; job_description_id: string; status: string; match_score: string | null; error_code: string | null; created_at: Date; completed_at: Date | null; resume_title: string; job_title: string; company_name: string | null }) { return { id: row.id, resumeId: row.resume_id, jobDescriptionId: row.job_description_id, resumeTitle: row.resume_title, jobTitle: row.job_title, companyName: row.company_name, status: row.status, matchScore: row.match_score === null ? null : Number(row.match_score), errorCode: row.error_code, createdAt: row.created_at.toISOString(), completedAt: row.completed_at?.toISOString() ?? null }; }
export function toDetail(row: AnalysisRow) { return { id: row.id, resumeId: row.resume_id, jobDescriptionId: row.job_description_id, status: row.status, matchScore: row.match_score === null ? null : Number(row.match_score), result: row.result, modelName: row.model_name, promptVersion: row.prompt_version, scoringVersion: row.scoring_version, errorCode: row.error_code, createdAt: row.created_at.toISOString(), completedAt: row.completed_at?.toISOString() ?? null }; }
export function validationError(error: unknown): AppError { return error instanceof ZodError ? new AppError(400, 'Invalid analysis request', 'VALIDATION_ERROR') : error instanceof AppError ? error : new AppError(500, 'Internal server error', 'INTERNAL_ERROR'); }
