import type { RequestHandler } from 'express';
import { parseCookie } from 'cookie';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/app-error.js';
import { CSRF_COOKIE, SESSION_COOKIE } from './auth.cookies.js';
import { hashSessionToken, tokensMatch } from './auth.service.js';
import { createAuthRepository } from './auth.repository.js';
import type { Pool } from 'pg';

function cookies(req: Parameters<RequestHandler>[0]): Record<string, string> {
  return parseCookie(req.headers.cookie ?? '') as Record<string, string>;
}

export const csrfProtection: RequestHandler = (req, _res, next) => {
  const origin = req.get('origin');
  if (origin && origin !== env.CORS_ORIGIN) return next(new AppError(403, 'CSRF validation failed', 'CSRF_INVALID'));
  const parsed = cookies(req);
  const header = req.get('x-csrf-token');
  if (!header || !parsed[CSRF_COOKIE] || !tokensMatch(header, parsed[CSRF_COOKIE])) return next(new AppError(403, 'CSRF validation failed', 'CSRF_INVALID'));
  next();
};

export function authenticate(pool: Pick<Pool, 'query'>): RequestHandler {
  const repo = createAuthRepository(pool);
  return async (req, res, next) => {
    try {
      const rawToken = cookies(req)[SESSION_COOKIE];
      if (!rawToken) throw new AppError(401, 'Authentication required', 'AUTHENTICATION_REQUIRED');
      const user = await repo.findUserBySessionHash(hashSessionToken(rawToken));
      if (!user) throw new AppError(401, 'Authentication required', 'AUTHENTICATION_REQUIRED');
      res.locals.authUser = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function readSessionToken(req: Parameters<RequestHandler>[0]): string | undefined { return cookies(req)[SESSION_COOKIE]; }
