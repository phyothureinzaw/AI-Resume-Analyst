import { ZodError } from 'zod';
import { AppError } from '../../shared/errors/app-error.js';
import { createResumeSchema, listResumeSchema, patchResumeSchema, resumeIdSchema } from './resumes.schema.js';
import type { ResumeInput, ResumePatch, ResumeRow } from './resumes.types.js';

function parse<T>(fn: () => T): T { try { return fn(); } catch (error) { if (error instanceof ZodError) throw new AppError(400, 'Invalid resume request', 'VALIDATION_ERROR'); throw error; } }
export function toResume(row: ResumeRow) { return { id: row.id, userId: row.user_id, title: row.title, originalFileName: row.original_file_name, storageKey: row.storage_key, fileSizeBytes: row.file_size_bytes, resumeText: row.resume_text, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString() }; }
export function toResumeSummary(row: Omit<ResumeRow, 'resume_text'>) { return { id: row.id, userId: row.user_id, title: row.title, originalFileName: row.original_file_name, storageKey: row.storage_key, fileSizeBytes: row.file_size_bytes, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString() }; }
export function validateCreate(input: unknown): ResumeInput { return parse(() => createResumeSchema.parse(input)); }
export function validatePatch(input: unknown): ResumePatch { return parse(() => patchResumeSchema.parse(input)); }
export function validateId(input: unknown): string { return parse(() => resumeIdSchema.parse(input).id); }
export function validateList(input: unknown) { return parse(() => listResumeSchema.parse(input)); }
export function notFound(): never { throw new AppError(404, 'Resume not found', 'RESUME_NOT_FOUND'); }
