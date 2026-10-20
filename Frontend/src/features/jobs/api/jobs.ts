import { deleteJson, getJson, patchJson, postJson } from '../../../shared/api/client';
import type { Job, JobList } from '../types';
export const jobKeys = { all: ['jobs'] as const, list: (page: number, pageSize: number, search: string) => ['jobs', 'list', { page, pageSize, search }] as const, detail: (id: string) => ['jobs', 'detail', id] as const };
export function listJobs(page: number, pageSize: number, search: string, signal?: AbortSignal): Promise<JobList> { const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), search }); return getJson<JobList>(`/jobs?${params.toString()}`, signal); }
export function getJob(id: string, signal?: AbortSignal): Promise<{ job: Job }> { return getJson<{ job: Job }>(`/jobs/${id}`, signal); }
export function createJob(input: { jobTitle: string; companyName?: string | null; descriptionText: string }): Promise<{ job: Job }> { return postJson<{ job: Job }>('/jobs', input); }
export function updateJob(id: string, input: { jobTitle?: string; companyName?: string | null; descriptionText?: string }): Promise<{ job: Job }> { return patchJson<{ job: Job }>(`/jobs/${id}`, input); }
export function deleteJob(id: string): Promise<void> { return deleteJson<void>(`/jobs/${id}`); }
