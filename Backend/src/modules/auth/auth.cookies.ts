import { stringifySetCookie } from 'cookie';
import type { SetCookie } from 'cookie';
import { env } from '../../config/env.js';

export const SESSION_COOKIE = 'resume_match_session';
export const CSRF_COOKIE = 'resume_match_csrf';

const commonCookieOptions: Omit<SetCookie, 'name' | 'value'> = {
  path: '/',
  sameSite: 'lax',
  secure: env.NODE_ENV === 'production'
};

export function sessionCookie(rawToken: string, maxAgeSeconds: number): string {
  return stringifySetCookie({ ...commonCookieOptions, name: SESSION_COOKIE, value: rawToken, httpOnly: true, maxAge: maxAgeSeconds });
}

export function clearSessionCookie(): string {
  return stringifySetCookie({ ...commonCookieOptions, name: SESSION_COOKIE, value: '', httpOnly: true, maxAge: 0 });
}

export function csrfCookie(token: string): string {
  return stringifySetCookie({ ...commonCookieOptions, name: CSRF_COOKIE, value: token, httpOnly: false, maxAge: 60 * 60 });
}
