import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { hash, verify, Algorithm } from '@node-rs/argon2';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { AuthRepository, SafeUser, UserRow } from './auth.types.js';
import type { LoginInput, RegisterInput } from './auth.schema.js';

const dummyHashPromise = hash('resume-match-invalid-user-dummy', { algorithm: Algorithm.Argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });

export function toSafeUser(user: UserRow): SafeUser {
  return { id: user.id, fullName: user.full_name, email: user.email, createdAt: user.created_at.toISOString() };
}

export function hashSessionToken(token: string): string { return createHash('sha256').update(token).digest('hex'); }

export function tokensMatch(left: string, right: string): boolean {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function register(repo: AuthRepository, input: RegisterInput): Promise<SafeUser> {
  const passwordHash = await hash(input.password, { algorithm: Algorithm.Argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  try {
    return toSafeUser(await repo.createUser(input.fullName, input.email, passwordHash));
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') throw new AppError(409, 'An account with that email already exists', 'EMAIL_ALREADY_EXISTS');
    throw error;
  }
}

export async function login(repo: AuthRepository, input: LoginInput): Promise<{ user: SafeUser; rawToken: string; expiresAt: Date }> {
  const user = await repo.findUserByEmail(input.email);
  const passwordHash = user?.password_hash ?? await dummyHashPromise;
  const valid = await verify(passwordHash, input.password);
  if (!user || !valid) throw new AppError(401, 'Email or password is incorrect', 'INVALID_CREDENTIALS');
  const rawToken = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await repo.createSession(user.id, hashSessionToken(rawToken), expiresAt);
  return { user: toSafeUser(user), rawToken, expiresAt };
}
