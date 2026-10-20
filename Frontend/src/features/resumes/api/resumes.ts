import { deleteJson, getJson, patchJson, postForm, postJson } from '../../../shared/api/client';
import type { Resume, ResumeList } from '../types';
export const resumeKeys = { all: ['resumes'] as const, list: (page: number, pageSize: number, search: string) => ['resumes', 'list', { page, pageSize, search }] as const, detail: (id: string) => ['resumes', 'detail', id] as const };
export function listResumes(page: number, pageSize: number, search: string, signal?: AbortSignal): Promise<ResumeList> { const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), search }); return getJson<ResumeList>(`/resumes?${params.toString()}`, signal); }
export function getResume(id: string, signal?: AbortSignal): Promise<{ resume: Resume }> { return getJson<{ resume: Resume }>(`/resumes/${id}`, signal); }
export function createResume(input: { title: string; resumeText: string }): Promise<{ resume: Resume }> { return postJson<{ resume: Resume }>('/resumes', input); }
export function updateResume(id: string, input: { title?: string; resumeText?: string }): Promise<{ resume: Resume }> { return patchJson<{ resume: Resume }>(`/resumes/${id}`, input); }
export function deleteResume(id: string): Promise<void> { return deleteJson<void>(`/resumes/${id}`); }
export function extractPdf(file: File): Promise<{ resumeText: string }> { const form = new FormData(); form.append('file', file); return postForm<{ resumeText: string }>('/resumes/extract', form); }
