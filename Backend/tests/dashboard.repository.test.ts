import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Pool, PoolClient } from 'pg';
import { createDashboardRepository } from '../src/modules/dashboard/dashboard.repository.js';

describe('dashboard repository', () => {
  it('returns user-scoped metrics and latest summaries in one transaction', async () => {
    const calls: Array<{ sql: string; values?: unknown[] }> = [];
    const client = {
      query: async (sql: string, values?: unknown[]) => {
        calls.push({ sql, values });
        if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
        if (sql === 'ROLLBACK') return { rows: [] };
        if (sql.includes('COUNT(*)')) return { rows: [{ resume_count: '2', job_count: '3', analysis_count: '4', pending_count: '1', processing_count: '1', completed_count: '1', failed_count: '1' }] };
        return { rows: [{ id: 'a1', resume_id: 'r1', resume_title: 'Resume one', job_description_id: 'j1', job_title: 'Engineer', company_name: null, status: 'completed', match_score: '82.5', created_at: '2026-01-01T00:00:00.000Z', completed_at: '2026-01-01T00:01:00.000Z' }, { id: 'a2', resume_id: 'r2', resume_title: 'Resume two', job_description_id: 'j2', job_title: 'Designer', company_name: 'Example', status: 'processing', match_score: '91', created_at: '2025-12-01T00:00:00.000Z', completed_at: null }] };
      },
      release: () => undefined
    } as unknown as PoolClient;
    const repo = createDashboardRepository({ connect: async () => client } as unknown as Pool);
    const result = await repo.get('user-a');
    assert.deepEqual(result.counts, { resumes: 2, jobs: 3, analyses: 4 });
    assert.deepEqual(result.analysisStatuses, { pending: 1, processing: 1, completed: 1, failed: 1 });
    assert.equal(result.latestAnalyses[0]?.score, 82.5);
    assert.equal(result.latestAnalyses[1]?.score, null);
    assert.equal(calls.filter((call) => call.sql === 'BEGIN').length, 1);
    assert.equal(calls.filter((call) => call.sql === 'COMMIT').length, 1);
    assert.ok(calls.some((call) => call.sql.includes('ORDER BY a.created_at DESC, a.id DESC')));
    assert.ok(calls.filter((call) => call.values?.[0] === 'user-a').length >= 2);
    assert.ok(calls.every((call) => !call.sql.includes('resume_text_snapshot') && !call.sql.includes('job_text_snapshot') && !call.sql.includes('claim_token')));
  });
});
