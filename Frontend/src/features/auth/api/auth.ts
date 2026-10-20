import { getJson, postJson } from '../../../shared/api/client';
import type { AuthResponse } from '../types';
export function getCurrentUser(signal?: AbortSignal): Promise<AuthResponse> { return getJson<AuthResponse>('/auth/me', signal); }
export function register(input: { fullName: string; email: string; password: string }): Promise<AuthResponse> { return postJson<AuthResponse>('/auth/register', input); }
export function login(input: { email: string; password: string }): Promise<AuthResponse> { return postJson<AuthResponse>('/auth/login', input); }
export function logout(): Promise<void> { return postJson<void>('/auth/logout'); }
