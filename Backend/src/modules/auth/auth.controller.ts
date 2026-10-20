import { randomBytes } from 'node:crypto';
import type { RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../../shared/errors/app-error.js';
import { clearSessionCookie, csrfCookie, sessionCookie } from './auth.cookies.js';
import { csrfProtection, readSessionToken } from './auth.middleware.js';
import { loginSchema, registerSchema } from './auth.schema.js';
import { createAuthRepository } from './auth.repository.js';
import { hashSessionToken, login as loginUser, register as registerUser, toSafeUser } from './auth.service.js';
import type { Pool } from 'pg';

function validationError(error: unknown): AppError {
  if (error instanceof ZodError) return new AppError(400, 'Invalid request', 'VALIDATION_ERROR');
  return error instanceof AppError ? error : new AppError(500, 'Internal server error', 'INTERNAL_ERROR');
}

function noStore(res: Parameters<RequestHandler>[1]): void { res.setHeader('Cache-Control', 'no-store'); }

export function authController(pool: Pick<Pool, 'query'>) {
  const repo = createAuthRepository(pool);
  return {
    csrf: ((_req, res) => { const token = randomBytes(32).toString('base64url'); noStore(res); res.setHeader('Set-Cookie', csrfCookie(token)); res.status(200).json({ csrfToken: token }); }) as RequestHandler,
    register: (async (req, res, next) => { try { const user = await registerUser(repo, registerSchema.parse(req.body)); noStore(res); res.status(201).json({ user }); } catch (error) { next(validationError(error)); } }) as RequestHandler,
    login: (async (req, res, next) => { try { const result = await loginUser(repo, loginSchema.parse(req.body)); const maxAge = Math.max(0, Math.floor((result.expiresAt.getTime() - Date.now()) / 1000)); noStore(res); res.setHeader('Set-Cookie', sessionCookie(result.rawToken, maxAge)); res.status(200).json({ user: result.user }); } catch (error) { next(validationError(error)); } }) as RequestHandler,
    logout: (async (req, res, next) => { try { const rawToken = readSessionToken(req); if (rawToken) await repo.revokeSession(hashSessionToken(rawToken)); noStore(res); res.setHeader('Set-Cookie', clearSessionCookie()); res.status(204).send(); } catch (error) { next(error); } }) as RequestHandler,
    me: ((req, res) => { noStore(res); res.status(200).json({ user: toSafeUser(res.locals.authUser) }); }) as RequestHandler,
    csrfProtection
  };
}
