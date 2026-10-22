import { getJson, postJson } from '../../../shared/api/client';
import type { InterviewPreparation, InterviewPreparationList } from '../types';

export const interviewPreparationKeys = {
  all: ['interview-preparations'] as const,
  list: (page: number, pageSize: number, status?: string) => ['interview-preparations', 'list', { page, pageSize, status }] as const,
  detail: (id: string) => ['interview-preparations', 'detail', id] as const
};

export function listInterviewPreparations(page: number, pageSize: number, status?: string, signal?: AbortSignal): Promise<InterviewPreparationList> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (status) params.set('status', status);
  return getJson<InterviewPreparationList>(`/interview-preparations?${params.toString()}`, signal);
}

export function getInterviewPreparation(id: string, signal?: AbortSignal): Promise<{ preparation: InterviewPreparation }> {
  return getJson<{ preparation: InterviewPreparation }>(`/interview-preparations/${id}`, signal);
}

export function createInterviewPreparation(input: { jobDescriptionId: string; resumeId: string | null; requestId: string }): Promise<{ preparationId: string; status: string; replayed?: boolean }> {
  return postJson<{ preparationId: string; status: string; replayed?: boolean }>('/interview-preparations', input);
}
