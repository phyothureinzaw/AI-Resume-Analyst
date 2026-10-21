import { ZodError } from 'zod';
import { analysisCreateSchema, analysisListSchema, analysisResultSchema } from './analysis.schema.js';
import type { AnalysisResult, AnalysisRow } from './analysis.types.js';
import { validateEvidence } from './evidence.js';
import { scoreAnalysis } from './scoring.js';
import { AppError } from '../../shared/errors/app-error.js';

export const PROMPT_VERSION = 'resume-job-v1';
export function validateCreate(value: unknown) { return analysisCreateSchema.parse(value); }
export function validateList(value: unknown) { return analysisListSchema.parse(value); }
export function validateId(value: unknown): string { const result = String((value as { id?: unknown }).id ?? ''); if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result)) throw new AppError(400, 'Invalid analysis id', 'VALIDATION_ERROR'); return result; }
export function parseProviderResult(text: string, resumeSnapshot: string, jobSnapshot: string): { result: AnalysisResult; score: number } {
  let parsed: unknown; try { parsed = JSON.parse(text); } catch { throw new AppError(502, 'Analysis provider returned invalid output', 'ANALYSIS_INVALID_OUTPUT'); }
  try { const result = analysisResultSchema.parse(parsed); validateEvidence(result, resumeSnapshot, jobSnapshot); return { result, score: scoreAnalysis(result) }; } catch (error) { if (error instanceof AppError) throw error; throw new AppError(502, 'Analysis provider returned unsupported output', 'ANALYSIS_INVALID_OUTPUT'); }
}
export function toSummary(row: { id: string; resume_id: string; job_description_id: string; status: string; match_score: string | null; error_code: string | null; created_at: Date; completed_at: Date | null; resume_title: string; job_title: string; company_name: string | null }) { return { id: row.id, resumeId: row.resume_id, jobDescriptionId: row.job_description_id, resumeTitle: row.resume_title, jobTitle: row.job_title, companyName: row.company_name, status: row.status, matchScore: row.match_score === null ? null : Number(row.match_score), errorCode: row.error_code, createdAt: row.created_at.toISOString(), completedAt: row.completed_at?.toISOString() ?? null }; }
export function toDetail(row: AnalysisRow) { return { id: row.id, resumeId: row.resume_id, jobDescriptionId: row.job_description_id, status: row.status, matchScore: row.match_score === null ? null : Number(row.match_score), result: row.result, modelName: row.model_name, promptVersion: row.prompt_version, scoringVersion: row.scoring_version, errorCode: row.error_code, createdAt: row.created_at.toISOString(), completedAt: row.completed_at?.toISOString() ?? null }; }
export function validationError(error: unknown): AppError { return error instanceof ZodError ? new AppError(400, 'Invalid analysis request', 'VALIDATION_ERROR') : error instanceof AppError ? error : new AppError(500, 'Internal server error', 'INTERNAL_ERROR'); }
