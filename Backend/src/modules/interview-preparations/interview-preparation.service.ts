import { ZodError } from 'zod';
import { AppError } from '../../shared/errors/app-error.js';
import { interviewPreparationCreateSchema, interviewPreparationIdSchema, interviewPreparationListSchema } from './interview-preparation.schema.js';
export { INTERVIEW_PROMPT_VERSION, INTERVIEW_RESULT_SCHEMA_VERSION } from './interview-preparation.result.js';


function parse<T>(fn: () => T): T { try { return fn(); } catch (error) { if (error instanceof ZodError) throw new AppError(400, 'Invalid interview preparation request', 'VALIDATION_ERROR'); throw error; } }
export function validateCreate(input: unknown) { return parse(() => interviewPreparationCreateSchema.parse(input)); }
export function validateList(input: unknown) { return parse(() => interviewPreparationListSchema.parse(input)); }
export function validateId(input: unknown): string { return parse(() => interviewPreparationIdSchema.parse(input).id); }
export function failureCopy(code: string | null): { code: string; message: string } {
  const safeCode = code && /^[A-Z0-9_]+$/.test(code) ? code : 'INTERVIEW_PREPARATION_FAILED';
  return { code: safeCode, message: safeCode === 'INTERVIEW_INPUT_TOO_LARGE' ? 'The saved source text is too large for interview preparation.' : safeCode === 'INTERVIEW_JOB_CONTENT_INSUFFICIENT' ? 'The saved job description does not contain enough meaningful role requirements. Add responsibilities, skills, or qualifications and start a new preparation.' : 'Interview preparation could not be completed.' };
}
export function toSummary(row: { id: string; job_description_id: string; resume_id: string | null; job_title_snapshot: string; company_name_snapshot: string | null; resume_title_snapshot: string | null; status: string; created_at: Date; completed_at: Date | null }) {
  return { id: row.id, jobDescriptionId: row.job_description_id, resumeId: row.resume_id, jobTitle: row.job_title_snapshot, companyName: row.company_name_snapshot, resumeTitle: row.resume_title_snapshot, status: row.status, createdAt: row.created_at.toISOString(), completedAt: row.completed_at?.toISOString() ?? null };
}
export function toDetail(row: { id: string; job_description_id: string; resume_id: string | null; job_title_snapshot: string; company_name_snapshot: string | null; resume_title_snapshot: string | null; status: string; result: Record<string, unknown> | null; error_code: string | null; created_at: Date; completed_at: Date | null }) {
  return { id: row.id, jobDescriptionId: row.job_description_id, resumeId: row.resume_id, jobTitle: row.job_title_snapshot, companyName: row.company_name_snapshot, resumeTitle: row.resume_title_snapshot, status: row.status, result: row.result, error: row.status === 'failed' ? failureCopy(row.error_code) : null, createdAt: row.created_at.toISOString(), completedAt: row.completed_at?.toISOString() ?? null };
}
