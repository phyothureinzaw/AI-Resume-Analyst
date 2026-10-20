import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { verify } from '@node-rs/argon2';
import { AppError } from '../src/shared/errors/app-error.js';
import { login, register } from '../src/modules/auth/auth.service.js';
import type { AuthRepository, UserRow } from '../src/modules/auth/auth.types.js';

const user: UserRow = { id: '00000000-0000-0000-0000-000000000001', full_name: 'Asha Lin', email: 'asha@example.com', password_hash: '', created_at: new Date('2026-01-01T00:00:00.000Z') };

function repo(overrides: Partial<AuthRepository> = {}): AuthRepository {
  return { findUserByEmail: async () => null, createUser: async (_fullName, _email, passwordHash) => ({ ...user, password_hash: passwordHash }), createSession: async () => undefined, findUserBySessionHash: async () => null, revokeSession: async () => undefined, ...overrides };
}

describe('authentication service', () => {
  it('hashes passwords with Argon2id and returns a safe user DTO', async () => {
    let capturedHash = '';
    const result = await register(repo({ createUser: async (_fullName, _email, passwordHash) => { capturedHash = passwordHash; return { ...user, password_hash: passwordHash }; } }), { fullName: ' Asha Lin ', email: 'asha@example.com', password: 'a long password 123' });
    assert.equal(result.fullName, 'Asha Lin');
    assert.equal(result.email, 'asha@example.com');
    assert.equal('passwordHash' in result, false);
    assert.match(capturedHash, /^\$argon2id\$/);
    assert.equal(await verify(capturedHash, 'a long password 123'), true);
  });

  it('maps a unique-email race to a conflict', async () => {
    await assert.rejects(() => register(repo({ createUser: async () => { throw { code: '23505' }; } }), { fullName: 'Asha Lin', email: 'asha@example.com', password: 'a long password 123' }), (error: unknown) => error instanceof AppError && error.statusCode === 409);
  });

  it('creates a fresh session and rejects invalid credentials generically', async () => {
    const passwordHash = await (await import('@node-rs/argon2')).hash('a long password 123');
    let session: { userId: string; tokenHash: string; expiresAt: Date } | undefined;
    const result = await login(repo({ findUserByEmail: async () => ({ ...user, password_hash: passwordHash }), createSession: async (userId, tokenHash, expiresAt) => { session = { userId, tokenHash, expiresAt }; } }), { email: 'ASHA@example.com', password: 'a long password 123' });
    assert.equal(result.user.email, 'asha@example.com');
    assert.equal(result.rawToken.length > 20, true);
    assert.equal(session?.userId, user.id);
    assert.equal(session?.tokenHash.length, 64);
    assert.equal(session?.expiresAt.getTime() > Date.now(), true);
    await assert.rejects(() => login(repo({ findUserByEmail: async () => ({ ...user, password_hash: passwordHash }) }), { email: 'asha@example.com', password: 'wrong password' }), (error: unknown) => error instanceof AppError && error.statusCode === 401 && error.message === 'Email or password is incorrect');
  });
});
