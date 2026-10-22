import assert from 'node:assert/strict';
import test from 'node:test';
import type { Pool, PoolClient } from 'pg';
import { interviewPreparationCreateSchema, interviewPreparationListSchema } from '../src/modules/interview-preparations/interview-preparation.schema.js';
import { createInterviewPreparationRepository } from '../src/modules/interview-preparations/interview-preparation.repository.js';
import { toDetail, toSummary } from '../src/modules/interview-preparations/interview-preparation.service.js';

const jobOnly = { jobDescriptionId: '00000000-0000-0000-0000-000000000001', requestId: '00000000-0000-0000-0000-000000000011' };
const withResume = { ...jobOnly, resumeId: '00000000-0000-0000-0000-000000000002' };
const row = { id: '00000000-0000-0000-0000-000000000010', user_id: 'user-a', job_description_id: jobOnly.jobDescriptionId, resume_id: null, request_id: jobOnly.requestId, status: 'pending', job_title_snapshot: 'Backend engineer', company_name_snapshot: 'Example', resume_title_snapshot: null, job_text_snapshot: 'Required: TypeScript experience.', resume_text_snapshot: null, result: null, model_name: null, prompt_version: 'interview-preparation-v1', result_schema_version: 'interview-preparation-v1', error_code: null, attempt_count: 0, next_attempt_at: new Date('2026-01-01T00:00:00Z'), lease_expires_at: null, claim_token: null, created_at: new Date('2026-01-01T00:00:00Z'), completed_at: null };

test('strictly validates create and list inputs', () => {
  assert.deepEqual(interviewPreparationCreateSchema.parse(jobOnly).resumeId, null);
  assert.deepEqual(interviewPreparationCreateSchema.parse({ ...withResume, resumeId: null }).resumeId, null);
  assert.throws(() => interviewPreparationCreateSchema.parse({ ...jobOnly, extra: true }));
  assert.throws(() => interviewPreparationCreateSchema.parse({ ...jobOnly, jobDescriptionId: 'not-a-uuid' }));
  assert.deepEqual(interviewPreparationListSchema.parse({}).pageSize, 10);
  assert.throws(() => interviewPreparationListSchema.parse({ pageSize: 51 }));
});

test('creates a job-only preparation with atomic source snapshots', async () => {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  const client = { query: async <T extends object>(sql: string, values?: unknown[]) => { calls.push({ sql, values }); if (sql.includes('SELECT id,user_id') && sql.includes('request_id')) return { rows: [] as T[] }; if (sql.includes('COUNT(*)')) return { rows: [{ count: '0' }] as T[] }; if (sql.includes('FROM job_descriptions')) return { rows: [{ job_title: 'Backend engineer', company_name: 'Example', description_text: 'Required: TypeScript experience.' }] as T[] }; if (sql.startsWith('INSERT INTO interview_preparations')) return { rows: [row] as T[] }; return { rows: [] as T[] }; }, release: () => undefined } as unknown as PoolClient;
  const repo = createInterviewPreparationRepository({ connect: async () => client } as unknown as Pool);
  const result = await repo.create('user-a', { ...jobOnly, resumeId: null }, 'interview-preparation-v1', 'interview-preparation-v1', 2);
  assert.equal(result.kind, 'created');
  const insert = calls.find((call) => call.sql.startsWith('INSERT INTO interview_preparations'));
  assert.ok(insert);
  assert.equal(insert.values?.[2], null);
  assert.equal(insert.values?.[7], 'Required: TypeScript experience.');
  assert.equal(insert.values?.[8], null);
  assert.ok(calls.some((call) => call.sql.includes('pg_advisory_xact_lock')));
});

test('replays omitted and null resume selections, and conflicts on a different selection', async () => {
  const replayRow = { ...row, resume_id: null };
  const client = { query: async <T extends object>(sql: string) => { if (sql.includes('request_id') && sql.includes('FOR UPDATE')) return { rows: [replayRow] as T[] }; return { rows: [] as T[] }; }, release: () => undefined } as unknown as PoolClient;
  const repo = createInterviewPreparationRepository({ connect: async () => client } as unknown as Pool);
  assert.equal((await repo.create('user-a', { ...jobOnly, resumeId: null }, 'p', 's', 2)).kind, 'replay');
  assert.equal((await repo.create('user-a', { ...jobOnly, resumeId: null }, 'p', 's', 2)).kind, 'replay');
  assert.equal((await repo.create('user-a', withResume, 'p', 's', 2)).kind, 'conflict');
});

test('list and detail DTOs exclude snapshots and queue internals', async () => {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  const pool = { query: async <T extends object>(sql: string, values?: unknown[]) => { calls.push({ sql, values }); if (sql.includes('COUNT(*)')) return { rows: [{ count: '1' }] as T[] }; return { rows: [{ id: row.id, job_description_id: row.job_description_id, resume_id: null, job_title_snapshot: row.job_title_snapshot, company_name_snapshot: row.company_name_snapshot, resume_title_snapshot: null, status: 'pending', created_at: row.created_at, completed_at: null }] as T[] }; } } as unknown as Pool;
  const repo = createInterviewPreparationRepository(pool);
  const result = await repo.list('user-a', 1, 10);
  assert.equal(result.total, 1);
  assert.equal(result.items[0]?.job_title_snapshot, 'Backend engineer');
  assert.ok(calls.some((call) => call.sql.includes('ORDER BY created_at DESC,id DESC')));
  assert.ok(calls.every((call) => !call.sql.includes('job_text_snapshot') && !call.sql.includes('resume_text_snapshot') && !call.sql.includes('claim_token')));
  const summary = toSummary({ ...row, status: 'completed', completed_at: new Date('2026-01-01T01:00:00Z') });
  assert.equal('job_text_snapshot' in summary, false);
  const detail = toDetail({ ...row, status: 'failed', error_code: 'ANALYSIS_FAILED', completed_at: new Date('2026-01-01T01:00:00Z') });
  assert.equal(detail.error?.code, 'ANALYSIS_FAILED');
  assert.equal('resume_text_snapshot' in detail, false);
});
