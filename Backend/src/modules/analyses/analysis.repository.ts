import type { Pool, PoolClient } from 'pg';
import type { AnalysisResult, AnalysisRow, AnalysisStatus, AnalysisSummary } from './analysis.types.js';

const columns = `id,user_id,resume_id,job_description_id,status,resume_text_snapshot,job_text_snapshot,match_score,result,model_name,prompt_version,scoring_version,error_code,created_at,completed_at,request_id,attempt_count,next_attempt_at,lease_expires_at,claim_token`;
function mapSummary(row: Record<string, unknown>): AnalysisSummary { return { id: String(row.id), resumeId: String(row.resume_id), jobDescriptionId: String(row.job_description_id), resumeTitle: String(row.resume_title), jobTitle: String(row.job_title), companyName: row.company_name as string | null, status: row.status as AnalysisStatus, matchScore: row.match_score === null ? null : Number(row.match_score), errorCode: row.error_code as string | null, createdAt: new Date(String(row.created_at)).toISOString(), completedAt: row.completed_at ? new Date(String(row.completed_at)).toISOString() : null }; }

export function createAnalysisRepository(pool: Pool) {
  async function getById(client: Pool | PoolClient, userId: string, id: string): Promise<AnalysisRow | null> { const result = await client.query<AnalysisRow>(`SELECT ${columns} FROM resume_analyses WHERE id=$1 AND user_id=$2`, [id, userId]); return result.rows[0] ?? null; }
  async function getByRequest(client: Pool | PoolClient, userId: string, requestId: string): Promise<AnalysisRow | null> { const result = await client.query<AnalysisRow>(`SELECT ${columns} FROM resume_analyses WHERE request_id=$1 AND user_id=$2`, [requestId, userId]); return result.rows[0] ?? null; }
  return {
    async create(userId: string, resumeId: string, jobId: string, requestId: string, modelName: string, promptVersion: string, scoringVersion: string, maxActive: number): Promise<{ kind: 'created' | 'replay' | 'conflict' | 'limit' | 'missing'; analysis: AnalysisRow | null }> {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const replay = await client.query<AnalysisRow>(`SELECT ${columns} FROM resume_analyses WHERE user_id=$1 AND request_id=$2 FOR UPDATE`, [userId, requestId]);
        if (replay.rows[0]) { const row = replay.rows[0]; await client.query('COMMIT'); return { kind: row.resume_id === resumeId && row.job_description_id === jobId ? 'replay' : 'conflict', analysis: row }; }
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [userId]);
        const active = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM resume_analyses WHERE user_id=$1 AND status IN ('pending','processing')`, [userId]);
        if (Number(active.rows[0]?.count ?? 0) >= maxActive) { await client.query('ROLLBACK'); return { kind: 'limit', analysis: null }; }
        const sources = await client.query<{ resume_text: string; job_text: string }>(`SELECT r.resume_text, j.description_text AS job_text FROM resumes r JOIN job_descriptions j ON j.user_id=r.user_id WHERE r.id=$1 AND j.id=$2 AND r.user_id=$3`, [resumeId, jobId, userId]);
        if (!sources.rows[0]) { await client.query('ROLLBACK'); return { kind: 'missing', analysis: null }; }
        const inserted = await client.query<AnalysisRow>(`INSERT INTO resume_analyses (user_id,resume_id,job_description_id,status,resume_text_snapshot,job_text_snapshot,model_name,prompt_version,scoring_version,request_id,attempt_count,next_attempt_at) VALUES ($1,$2,$3,'pending',$4,$5,$6,$7,$8,$9,0,now()) RETURNING ${columns}`, [userId, resumeId, jobId, sources.rows[0].resume_text, sources.rows[0].job_text, modelName, promptVersion, scoringVersion, requestId]);
        await client.query('COMMIT'); return { kind: 'created', analysis: inserted.rows[0]! };
      } catch (error) { await client.query('ROLLBACK'); if ((error as { code?: string }).code === '23505') { const replay = await getByRequest(pool, userId, requestId); return replay ? { kind: replay.resume_id === resumeId && replay.job_description_id === jobId ? 'replay' : 'conflict', analysis: replay } : { kind: 'conflict', analysis: null }; } throw error; } finally { client.release(); }
    },
    async list(userId: string, page: number, pageSize: number, status?: AnalysisStatus): Promise<{ items: AnalysisSummary[]; total: number }> {
      const offset = (page - 1) * pageSize; const params: unknown[] = [userId]; const filter = status ? ` AND a.status=$${params.push(status)}` : '';
      const count = await pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM resume_analyses a WHERE a.user_id=$1${filter}`, params);
      params.push(pageSize, offset); const rows = await pool.query<Record<string, unknown>>(`SELECT a.id,a.resume_id,a.job_description_id,a.status,a.match_score,a.error_code,a.created_at,a.completed_at,r.title AS resume_title,j.job_title,j.company_name FROM resume_analyses a JOIN resumes r ON r.id=a.resume_id AND r.user_id=a.user_id JOIN job_descriptions j ON j.id=a.job_description_id AND j.user_id=a.user_id WHERE a.user_id=$1${filter} ORDER BY a.created_at DESC,a.id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
      return { items: rows.rows.map(mapSummary), total: Number(count.rows[0]?.count ?? 0) };
    },
    async find(userId: string, id: string): Promise<AnalysisRow | null> { return getById(pool, userId, id); },
    async claimNext(leaseMs: number): Promise<AnalysisRow | null> {
      const client = await pool.connect(); try { await client.query('BEGIN'); const result = await client.query<AnalysisRow>(`WITH candidate AS (SELECT id FROM resume_analyses WHERE (status='pending' AND next_attempt_at <= now()) OR (status='processing' AND lease_expires_at < now()) ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1) UPDATE resume_analyses a SET status='processing',attempt_count=a.attempt_count+1,claim_token=gen_random_uuid(),lease_expires_at=now()+($1::text || ' milliseconds')::interval WHERE a.id=(SELECT id FROM candidate) RETURNING ${columns}`, [leaseMs]); await client.query('COMMIT'); return result.rows[0] ?? null; } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    },
    async complete(id: string, claimToken: string, result: AnalysisResult, score: number, modelName: string): Promise<boolean> { const updated = await pool.query(`UPDATE resume_analyses SET status='completed',result=$1,match_score=$2,model_name=$3,completed_at=now(),claim_token=NULL,lease_expires_at=NULL WHERE id=$4 AND status='processing' AND claim_token=$5`, [JSON.stringify(result), score, modelName, id, claimToken]); return updated.rowCount === 1; },
    async retry(id: string, claimToken: string, errorCode: string, delayMs: number, maxAttempts: number): Promise<boolean> { const updated = await pool.query(`UPDATE resume_analyses SET status=CASE WHEN attempt_count >= $1 THEN 'failed' ELSE 'pending' END,error_code=CASE WHEN attempt_count >= $1 THEN $2 ELSE NULL END,completed_at=CASE WHEN attempt_count >= $1 THEN now() ELSE NULL END,next_attempt_at=now()+($3::text || ' milliseconds')::interval,claim_token=NULL,lease_expires_at=NULL WHERE id=$4 AND status='processing' AND claim_token=$5`, [maxAttempts, errorCode, delayMs, id, claimToken]); return updated.rowCount === 1; },
    async fail(id: string, claimToken: string, errorCode: string): Promise<boolean> { const updated = await pool.query(`UPDATE resume_analyses SET status='failed',error_code=$1,completed_at=now(),claim_token=NULL,lease_expires_at=NULL WHERE id=$2 AND status='processing' AND claim_token=$3`, [errorCode, id, claimToken]); return updated.rowCount === 1; }
  };
}
