import type { Pool } from 'pg';
import type { AuthRepository, UserRow } from './auth.types.js';

export function createAuthRepository(pool: Pick<Pool, 'query'>): AuthRepository {
  return {
    async findUserByEmail(email): Promise<UserRow | null> {
      const result = await pool.query<UserRow>('SELECT id, full_name, email, password_hash, created_at FROM users WHERE email = $1', [email]);
      return result.rows[0] ?? null;
    },
    async createUser(fullName, email, passwordHash): Promise<UserRow> {
      const result = await pool.query<UserRow>('INSERT INTO users (full_name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, full_name, email, password_hash, created_at', [fullName, email, passwordHash]);
      const user = result.rows[0];
      if (!user) throw new Error('User insert returned no row');
      return user;
    },
    async createSession(userId, tokenHash, expiresAt): Promise<void> {
      await pool.query('INSERT INTO auth_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)', [userId, tokenHash, expiresAt]);
    },
    async findUserBySessionHash(tokenHash): Promise<UserRow | null> {
      const result = await pool.query<UserRow>('SELECT u.id, u.full_name, u.email, u.password_hash, u.created_at FROM auth_sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now()', [tokenHash]);
      return result.rows[0] ?? null;
    },
    async revokeSession(tokenHash): Promise<void> {
      await pool.query('DELETE FROM auth_sessions WHERE token_hash = $1', [tokenHash]);
    }
  };
}
