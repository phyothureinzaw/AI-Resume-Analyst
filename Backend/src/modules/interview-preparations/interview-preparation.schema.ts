import { z } from 'zod';

export const interviewPreparationCreateSchema = z.object({
  jobDescriptionId: z.string().uuid(),
  resumeId: z.string().uuid().nullable().optional().default(null),
  requestId: z.string().uuid()
}).strict();

export const interviewPreparationListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  status: z.enum(['pending', 'processing', 'completed', 'failed']).optional()
});

export const interviewPreparationIdSchema = z.object({ id: z.string().uuid() });
export type InterviewPreparationCreate = z.infer<typeof interviewPreparationCreateSchema>;
export type InterviewPreparationStatus = 'pending' | 'processing' | 'completed' | 'failed';
