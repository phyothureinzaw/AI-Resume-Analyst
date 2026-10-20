import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import request from 'supertest';
import type { Pool } from 'pg';
import { createApp } from '../src/app.js';

function fakePool(): Pick<Pool, 'query'> {
  return { query: async <T extends object>(_sql: string, _values?: unknown[]) => ({ rows: [] as T[] }) } as unknown as Pick<Pool, 'query'>;
}

describe('authentication routes', () => {
  it('protects current-user access without a session', async () => {
    const response = await request(createApp(fakePool())).get('/api/auth/me');
    assert.equal(response.status, 401);
    assert.equal(response.body.error.code, 'AUTHENTICATION_REQUIRED');
    assert.equal(response.headers['cache-control'], 'no-store');
  });

  it('rejects state-changing requests without a CSRF token and accepts a matching token', async () => {
    const app = createApp(fakePool());
    const csrfResponse = await request(app).get('/api/auth/csrf');
    const token = csrfResponse.body.csrfToken as string;
    const setCookies = csrfResponse.headers['set-cookie'];
    assert.ok(Array.isArray(setCookies));
    const cookie = setCookies[0]?.split(';')[0];
    assert.ok(cookie);
    const rejected = await request(app).post('/api/auth/logout').set('Origin', 'http://localhost:5173').set('Cookie', cookie);
    assert.equal(rejected.status, 403);
    const accepted = await request(app).post('/api/auth/logout').set('Origin', 'http://localhost:5173').set('Cookie', cookie).set('X-CSRF-Token', token);
    assert.equal(accepted.status, 204);
  });

  it('returns 429 after the authentication rate limit is exceeded', async () => {
    const app = createApp(fakePool());
    const responses = await Promise.all(Array.from({ length: 11 }, () => request(app).post('/api/auth/login').set('Origin', 'http://localhost:5173')));
    assert.equal(responses.at(-1)?.status, 429);
  });
});
