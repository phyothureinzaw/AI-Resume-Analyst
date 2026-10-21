import { getJson, postJson } from '../../../shared/api/client';
import type { Analysis, AnalysisSummary } from '../types';
export const analysisKeys = { all: ['analyses'] as const, list: (page: number, pageSize: number, status?: string) => ['analyses', 'list', { page, pageSize, status }] as const, detail: (id: string) => ['analyses', 'detail', id] as const };
export function listAnalyses(page: number, pageSize: number, status?: string, signal?: AbortSignal) { const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) }); if (status) params.set('status', status); return getJson<{ items: AnalysisSummary[]; pagination: { page: number; pageSize: number; totalItems: number; totalPages: number } }>(`/analyses?${params}`, signal); }
export function getAnalysis(id: string, signal?: AbortSignal) { return getJson<{ analysis: Analysis }>(`/analyses/${id}`, signal); }
export function createAnalysis(input: { resumeId: string; jobDescriptionId: string; requestId: string }) { return postJson<{ analysisId: string; status: string; replayed?: boolean }>('/analyses', input); }
