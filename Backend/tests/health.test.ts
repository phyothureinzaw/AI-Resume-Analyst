import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import request from 'supertest';
import type { Pool } from 'pg';
import { createApp } from '../src/app.js';

describe('health endpoints', () => {
  it('returns application health without using the database', async () => {
    const pool = { query: async () => { throw new Error('should not be called'); } } as unknown as Pick<Pool, 'query'>;
    const response = await request(createApp(pool)).get('/api/health');
    assert.equal(response.status, 200);
    assert.equal(response.body.status, 'ok');
    assert.ok(response.headers['x-request-id']);
  });

  it('returns ready when SELECT 1 succeeds', async () => {
    const pool = { query: async (sql: string) => { assert.equal(sql, 'SELECT 1'); return { rows: [] }; } } as unknown as Pick<Pool, 'query'>;
    const response = await request(createApp(pool)).get('/api/health/ready');
    assert.equal(response.status, 200);
    assert.equal(response.body.database, 'available');
  });

  it('returns sanitized 503 when the database is unavailable', async () => {
    const pool = { query: async () => { throw new Error('connection refused with secret details'); } } as unknown as Pick<Pool, 'query'>;
    const response = await request(createApp(pool)).get('/api/health/ready');
    assert.equal(response.status, 503);
    assert.equal(response.body.error.code, 'DATABASE_UNAVAILABLE');
    assert.equal(response.body.error.message, 'Database unavailable');
    assert.doesNotMatch(JSON.stringify(response.body), /connection refused|secret details/i);
  });
});
