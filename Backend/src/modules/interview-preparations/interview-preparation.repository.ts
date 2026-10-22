import type { Pool, PoolClient } from 'pg';
import { InterviewInputValidationError, validateInterviewSnapshots } from './interview-preparation.result.js';
import type { InterviewPreparationCreate, InterviewPreparationStatus } from './interview-preparation.schema.js';
import type { InterviewPreparationRow, InterviewPreparationSummary } from './interview-preparation.types.js';

const columns = 'id,user_id,job_description_id,resume_id,request_id,status,job_title_snapshot,company_name_snapshot,resume_title_snapshot,job_text_snapshot,resume_text_snapshot,result,model_name,prompt_version,result_schema_version,error_code,attempt_count,next_attempt_at,lease_expires_at,claim_token,created_at,completed_at';
type SourceRow = { job_title: string; company_name: string | null; description_text: string; resume_id: string | null; resume_title: string | null; resume_text: string | null };
function mapSummary(row: Record<string, unknown>): InterviewPreparationSummary { return { id: String(row.id), job_description_id: String(row.job_description_id), resume_id: row.resume_id ? String(row.resume_id) : null, job_title_snapshot: String(row.job_title_snapshot), company_name_snapshot: row.company_name_snapshot as string | null, resume_title_snapshot: row.resume_title_snapshot as string | null, status: row.status as InterviewPreparationStatus, created_at: new Date(String(row.created_at)), completed_at: row.completed_at ? new Date(String(row.completed_at)) : null }; }
function sameResume(a: string | null, b: string | null): boolean { return (a ?? null) === (b ?? null); }

export function createInterviewPreparationRepository(pool: Pool) {
  async function findByRequest(client: Pool | PoolClient, userId: string, requestId: string): Promise<InterviewPreparationRow | null> { const result = await client.query<InterviewPreparationRow>(`SELECT ${columns} FROM interview_preparations WHERE user_id=$1 AND request_id=$2`, [userId, requestId]); return result.rows[0] ?? null; }
  return {
    async create(userId: string, input: InterviewPreparationCreate, promptVersion: string, resultSchemaVersion: string, maxActive: number): Promise<{ kind: 'created' | 'replay' | 'conflict' | 'limit' | 'missing' | 'too_large' | 'invalid_input'; preparation: InterviewPreparationRow | null }> {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const replay = await client.query<InterviewPreparationRow>(`SELECT ${columns} FROM interview_preparations WHERE user_id=$1 AND request_id=$2 FOR UPDATE`, [userId, input.requestId]);
        if (replay.rows[0]) { const row = replay.rows[0]; await client.query('COMMIT'); return { kind: row.job_description_id === input.jobDescriptionId && sameResume(row.resume_id, input.resumeId) ? 'replay' : 'conflict', preparation: row }; }
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [userId]);
        const active = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM interview_preparations WHERE user_id=$1 AND status IN ('pending','processing')`, [userId]);
        if (Number(active.rows[0]?.count ?? 0) >= maxActive) { await client.query('ROLLBACK'); return { kind: 'limit', preparation: null }; }
        const job = await client.query<{ job_title: string; company_name: string | null; description_text: string }>('SELECT job_title,company_name,description_text FROM job_descriptions WHERE id=$1 AND user_id=$2 FOR SHARE', [input.jobDescriptionId, userId]);
        if (!job.rows[0]) { await client.query('ROLLBACK'); return { kind: 'missing', preparation: null }; }
        let resume: { id: string; title: string; resume_text: string } | null = null;
        if (input.resumeId) { const selected = await client.query<{ id: string; title: string; resume_text: string }>('SELECT id,title,resume_text FROM resumes WHERE id=$1 AND user_id=$2 FOR SHARE', [input.resumeId, userId]); if (!selected.rows[0]) { await client.query('ROLLBACK'); return { kind: 'missing', preparation: null }; } resume = selected.rows[0]; }
        const source: SourceRow = { job_title: job.rows[0].job_title, company_name: job.rows[0].company_name, description_text: job.rows[0].description_text, resume_id: resume?.id ?? null, resume_title: resume?.title ?? null, resume_text: resume?.resume_text ?? null };
        try { validateInterviewSnapshots({ jobText: source.description_text, resumeId: source.resume_id, resumeText: source.resume_text }); } catch (error) { await client.query('ROLLBACK'); if (error instanceof InterviewInputValidationError && (error.diagnostics.reasonCode === 'JOB_SNAPSHOT_TOO_LARGE' || error.diagnostics.reasonCode === 'RESUME_SNAPSHOT_TOO_LARGE')) return { kind: 'too_large', preparation: null }; if (error instanceof InterviewInputValidationError) return { kind: 'invalid_input', preparation: null }; throw error; }
        const inserted = await client.query<InterviewPreparationRow>(`INSERT INTO interview_preparations (user_id,job_description_id,resume_id,request_id,status,job_title_snapshot,company_name_snapshot,resume_title_snapshot,job_text_snapshot,resume_text_snapshot,prompt_version,result_schema_version,attempt_count,next_attempt_at) VALUES ($1,$2,$3,$4,'pending',$5,$6,$7,$8,$9,$10,$11,0,now()) RETURNING ${columns}`, [userId, input.jobDescriptionId, source.resume_id, input.requestId, source.job_title, source.company_name, source.resume_title, source.description_text, source.resume_text, promptVersion, resultSchemaVersion]);
        await client.query('COMMIT'); return { kind: 'created', preparation: inserted.rows[0]! };
      } catch (error) { await client.query('ROLLBACK'); if ((error as { code?: string }).code === '23505') { const replay = await findByRequest(pool, userId, input.requestId); return replay ? { kind: replay.job_description_id === input.jobDescriptionId && sameResume(replay.resume_id, input.resumeId) ? 'replay' : 'conflict', preparation: replay } : { kind: 'conflict', preparation: null }; } throw error; } finally { client.release(); }
    },
    async list(userId: string, page: number, pageSize: number, status?: InterviewPreparationStatus): Promise<{ items: InterviewPreparationSummary[]; total: number }> {
      const offset = (page - 1) * pageSize; const params: unknown[] = [userId]; const filter = status ? ` AND status=$${params.push(status)}` : '';
      const count = await pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM interview_preparations WHERE user_id=$1${filter}`, params);
      params.push(pageSize, offset); const rows = await pool.query<Record<string, unknown>>(`SELECT id,job_description_id,resume_id,job_title_snapshot,company_name_snapshot,resume_title_snapshot,status,created_at,completed_at FROM interview_preparations WHERE user_id=$1${filter} ORDER BY created_at DESC,id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
      return { items: rows.rows.map(mapSummary), total: Number(count.rows[0]?.count ?? 0) };
    },
    async find(userId: string, id: string): Promise<InterviewPreparationRow | null> { const result = await pool.query<InterviewPreparationRow>(`SELECT ${columns} FROM interview_preparations WHERE id=$1 AND user_id=$2`, [id, userId]); return result.rows[0] ?? null; },
    async claimNext(leaseMs: number): Promise<InterviewPreparationRow | null> {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query<InterviewPreparationRow>(`WITH candidate AS (SELECT id FROM interview_preparations WHERE (status='pending' AND next_attempt_at <= now()) OR (status='processing' AND lease_expires_at < now()) ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1) UPDATE interview_preparations p SET status='processing',attempt_count=p.attempt_count+1,claim_token=gen_random_uuid(),lease_expires_at=now()+($1::text || ' milliseconds')::interval WHERE p.id=(SELECT id FROM candidate) RETURNING ${columns}`, [leaseMs]);
        await client.query('COMMIT');
        return result.rows[0] ?? null;
      } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    },
    async complete(id: string, claimToken: string, result: Record<string, unknown>, modelName: string): Promise<boolean> {
      const updated = await pool.query(`UPDATE interview_preparations SET status='completed',result=$1,model_name=$2,completed_at=now(),claim_token=NULL,lease_expires_at=NULL,error_code=NULL WHERE id=$3 AND status='processing' AND claim_token=$4`, [JSON.stringify(result), modelName, id, claimToken]);
      return updated.rowCount === 1;
    },
    async retry(id: string, claimToken: string, errorCode: string, delayMs: number, maxAttempts: number): Promise<boolean> {
      const updated = await pool.query(`UPDATE interview_preparations SET status=CASE WHEN attempt_count >= $1 THEN 'failed' ELSE 'pending' END,error_code=CASE WHEN attempt_count >= $1 THEN $2 ELSE NULL END,completed_at=CASE WHEN attempt_count >= $1 THEN now() ELSE NULL END,next_attempt_at=now()+($3::text || ' milliseconds')::interval,claim_token=NULL,lease_expires_at=NULL WHERE id=$4 AND status='processing' AND claim_token=$5`, [maxAttempts, errorCode, delayMs, id, claimToken]);
      return updated.rowCount === 1;
    },
    async fail(id: string, claimToken: string, errorCode: string): Promise<boolean> {
      const updated = await pool.query(`UPDATE interview_preparations SET status='failed',error_code=$1,completed_at=now(),claim_token=NULL,lease_expires_at=NULL WHERE id=$2 AND status='processing' AND claim_token=$3`, [errorCode, id, claimToken]);
      return updated.rowCount === 1;
    }
  };
}
