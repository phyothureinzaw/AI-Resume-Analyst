const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
let csrfToken: string | null = null;
export class ApiError extends Error { constructor(public readonly status: number, message: string, public readonly code?: string) { super(message); } }
type RequestOptions = { method?: 'GET' | 'POST'; body?: unknown; signal?: AbortSignal };
function isMutation(method: string): boolean { return method !== 'GET'; }
async function readBody(response: Response): Promise<unknown> { return response.status === 204 ? undefined : response.json().catch(() => null); }
function getError(body: unknown): { message: string; code?: string } { if (typeof body !== 'object' || body === null || !('error' in body) || typeof body.error !== 'object' || body.error === null) return { message: 'Request failed' }; const error = body.error as { message?: unknown; code?: unknown }; return { message: typeof error.message === 'string' ? error.message : 'Request failed', code: typeof error.code === 'string' ? error.code : undefined }; }
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> { const method = options.method ?? 'GET'; if (isMutation(method) && path !== '/auth/csrf' && !csrfToken) { const csrfResponse = await request<{ csrfToken: string }>('/auth/csrf'); csrfToken = csrfResponse.csrfToken; } const headers = new Headers(); if (options.body !== undefined) headers.set('Content-Type', 'application/json'); if (isMutation(method) && csrfToken) headers.set('X-CSRF-Token', csrfToken); const response = await fetch(`${apiBaseUrl}${path}`, { method, headers, credentials: 'include', body: options.body === undefined ? undefined : JSON.stringify(options.body), signal: options.signal }); const body = await readBody(response); if (!response.ok) { const error = getError(body); throw new ApiError(response.status, error.message, error.code); } return body as T; }
export function getJson<T>(path: string, signal?: AbortSignal): Promise<T> { return request<T>(path, { signal }); }
export function postJson<T>(path: string, body?: unknown): Promise<T> { return request<T>(path, { method: 'POST', body }); }
export function clearCsrfToken(): void { csrfToken = null; }
export async function getCsrfToken(): Promise<void> { const response = await request<{ csrfToken: string }>('/auth/csrf'); csrfToken = response.csrfToken; }
