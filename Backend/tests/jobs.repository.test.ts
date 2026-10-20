import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Pool } from 'pg';
import { createJobsRepository } from '../src/modules/jobs/jobs.repository.js';

describe('job repository ownership and search', () => {
  it('escapes wildcard search characters and scopes list queries by user', async () => {
    const calls: Array<{ sql: string; values?: unknown[] }> = [];
    const repo = createJobsRepository({ query: async (sql: string, values?: unknown[]) => { calls.push({ sql, values }); return sql.startsWith('SELECT COUNT') ? { rows: [{ count: '0' }] } : { rows: [] }; } } as unknown as Pool);
    await repo.list('user-a', 2, 10, '%_');
    assert.equal(calls.length, 2);
    assert.match(calls[0]!.sql, /user_id = \$1/);
    assert.match(calls[0]!.sql, /ILIKE \$4 ESCAPE/);
    assert.equal(calls[0]!.values?.[3], '%\\%\\_%');
  });

  it('updates an explicit null company without using COALESCE', async () => {
    let call: { sql: string; values?: unknown[] } | undefined;
    const repo = createJobsRepository({ query: async (sql: string, values?: unknown[]) => { call = { sql, values }; return { rows: [] }; } } as unknown as Pool);
    await repo.update('user-a', '00000000-0000-0000-0000-000000000001', { companyName: null });
    assert.ok(call);
    assert.match(call.sql, /company_name = \$1/);
    assert.doesNotMatch(call.sql, /COALESCE/);
    assert.deepEqual(call.values, [null, '00000000-0000-0000-0000-000000000001', 'user-a']);
    assert.match(call.sql, /user_id = \$3/);
  });
});
