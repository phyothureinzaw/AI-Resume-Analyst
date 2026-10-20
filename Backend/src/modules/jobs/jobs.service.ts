import { ZodError } from 'zod';
import { AppError } from '../../shared/errors/app-error.js';
import { createJobSchema, jobIdSchema, listJobSchema, patchJobSchema } from './jobs.schema.js';
import type { JobRow, JobSummary } from './jobs.types.js';

function parse<T>(fn: () => T): T { try { return fn(); } catch (error) { if (error instanceof ZodError) throw new AppError(400, 'Invalid job request', 'VALIDATION_ERROR'); throw error; } }
export function toJob(row: JobRow) { return { id: row.id, jobTitle: row.job_title, companyName: row.company_name, descriptionText: row.description_text, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString() }; }
export function toJobSummary(row: JobSummary) { return { id: row.id, jobTitle: row.job_title, companyName: row.company_name, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString() }; }
export function validateCreate(input: unknown) { return parse(() => createJobSchema.parse(input)); }
export function validatePatch(input: unknown) { return parse(() => patchJobSchema.parse(input)); }
export function validateId(input: unknown): string { return parse(() => jobIdSchema.parse(input).id); }
export function validateList(input: unknown) { return parse(() => listJobSchema.parse(input)); }
export function notFound(): never { throw new AppError(404, 'Job description not found', 'JOB_NOT_FOUND'); }
