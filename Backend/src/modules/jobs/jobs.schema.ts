import { z } from 'zod';

const companyName = z.preprocess((value) => typeof value === 'string' && value.trim() === '' ? null : value, z.string().trim().max(150).nullable().optional().default(null));
const descriptionText = z.string().max(100_000).refine((value) => value.trim().length > 0, 'Job description cannot be blank.');

export const createJobSchema = z.object({
  jobTitle: z.string().trim().min(1, 'Job title cannot be blank.').max(150),
  companyName,
  descriptionText
}).strict();

export const patchJobSchema = z.object({
  jobTitle: z.string().trim().min(1, 'Job title cannot be blank.').max(150).optional(),
  companyName: z.preprocess((value) => typeof value === 'string' && value.trim() === '' ? null : value, z.string().trim().max(150).nullable().optional()),
  descriptionText: descriptionText.optional()
}).strict().refine((value) => value.jobTitle !== undefined || value.companyName !== undefined || value.descriptionText !== undefined, 'Provide at least one field to update.');

export const jobIdSchema = z.object({ id: z.string().uuid('Job id must be a valid UUID.') });
export const listJobSchema = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(50).default(10), search: z.string().trim().max(100).default('') });

export type JobInput = z.infer<typeof createJobSchema>;
export type JobPatch = z.infer<typeof patchJobSchema>;
