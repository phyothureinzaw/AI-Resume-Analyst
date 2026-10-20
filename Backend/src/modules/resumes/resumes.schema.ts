import { z } from 'zod';

const resumeText = z.string().max(100_000, 'Resume text must be 100,000 characters or fewer.').refine((value) => value.trim().length > 0, 'Resume text cannot be blank.');

export const createResumeSchema = z.object({ title: z.string().trim().min(1, 'Title cannot be blank.').max(150, 'Title must be 150 characters or fewer.'), resumeText }).strict();
export const patchResumeSchema = z.object({ title: z.string().trim().min(1, 'Title cannot be blank.').max(150, 'Title must be 150 characters or fewer.').optional(), resumeText: resumeText.optional() }).strict().refine((value) => value.title !== undefined || value.resumeText !== undefined, 'Provide title or resumeText to update.');
export const resumeIdSchema = z.object({ id: z.string().uuid('Resume id must be a valid UUID.') });
export const listResumeSchema = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(50).default(10), search: z.string().trim().max(100).default('') });
