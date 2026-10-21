import { z } from 'zod';
import type { AnalysisResult } from './analysis.types.js';

export const analysisCreateSchema = z.object({ resumeId: z.string().uuid(), jobDescriptionId: z.string().uuid(), requestId: z.string().uuid() }).strict();
export const analysisListSchema = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(50).default(10), status: z.enum(['pending', 'processing', 'completed', 'failed']).optional() });

const excerpt = z.string().min(1).max(1_000);
export const analysisResultSchema = z.object({
  summary: z.string().min(1).max(2_000),
  requirements: z.array(z.object({
    id: z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/),
    requirementText: z.string().min(1).max(500),
    jobEvidenceExcerpt: excerpt,
    category: z.enum(['required', 'preferred']),
    evidenceStatus: z.enum(['supported', 'partial', 'not_evidenced']),
    resumeEvidenceExcerpts: z.array(excerpt).max(3),
    explanation: z.string().min(1).max(1_000),
    suggestions: z.array(z.string().min(1).max(500)).max(3)
  }).strict()).min(1).max(50),
  scoreExplanation: z.string().min(1).max(1_000)
}).strict().transform((value) => value as AnalysisResult);

export type ParsedAnalysisResult = z.infer<typeof analysisResultSchema>;
