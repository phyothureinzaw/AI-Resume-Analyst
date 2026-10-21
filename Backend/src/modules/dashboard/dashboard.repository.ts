import type { Pool, PoolClient } from 'pg';
import type { DashboardData, DashboardLatestAnalysis } from './dashboard.types.js';

function iso(value: unknown): string { return new Date(String(value)).toISOString(); }

export function createDashboardRepository(pool: Pool) {
  return {
    async get(userId: string): Promise<DashboardData> {
      const client: PoolClient = await pool.connect();
      try {
        await client.query('BEGIN');
        const metrics = await client.query<{ resume_count: string; job_count: string; analysis_count: string; pending_count: string; processing_count: string; completed_count: string; failed_count: string }>(`
          SELECT
            (SELECT COUNT(*) FROM resumes WHERE user_id = $1)::text AS resume_count,
            (SELECT COUNT(*) FROM job_descriptions WHERE user_id = $1)::text AS job_count,
            (SELECT COUNT(*) FROM resume_analyses WHERE user_id = $1)::text AS analysis_count,
            (SELECT COUNT(*) FROM resume_analyses WHERE user_id = $1 AND status = 'pending')::text AS pending_count,
            (SELECT COUNT(*) FROM resume_analyses WHERE user_id = $1 AND status = 'processing')::text AS processing_count,
            (SELECT COUNT(*) FROM resume_analyses WHERE user_id = $1 AND status = 'completed')::text AS completed_count,
            (SELECT COUNT(*) FROM resume_analyses WHERE user_id = $1 AND status = 'failed')::text AS failed_count
        `, [userId]);
        const latest = await client.query<Record<string, unknown>>(`
          SELECT a.id, a.resume_id, r.title AS resume_title, a.job_description_id,
                 j.job_title, j.company_name, a.status, a.match_score,
                 a.created_at, a.completed_at
          FROM resume_analyses a
          JOIN resumes r ON r.id = a.resume_id AND r.user_id = a.user_id
          JOIN job_descriptions j ON j.id = a.job_description_id AND j.user_id = a.user_id
          WHERE a.user_id = $1
          ORDER BY a.created_at DESC, a.id DESC
          LIMIT 5
        `, [userId]);
        await client.query('COMMIT');
        const row = metrics.rows[0]!;
        const latestAnalyses: DashboardLatestAnalysis[] = latest.rows.map((item) => ({
          id: String(item.id), resumeId: String(item.resume_id), resumeTitle: String(item.resume_title),
          jobDescriptionId: String(item.job_description_id), jobTitle: String(item.job_title),
          companyName: item.company_name as string | null, status: item.status as DashboardLatestAnalysis['status'],
          score: item.status === 'completed' && item.match_score !== null ? Number(item.match_score) : null,
          createdAt: iso(item.created_at), completedAt: item.completed_at ? iso(item.completed_at) : null
        }));
        return {
          counts: { resumes: Number(row.resume_count), jobs: Number(row.job_count), analyses: Number(row.analysis_count) },
          analysisStatuses: { pending: Number(row.pending_count), processing: Number(row.processing_count), completed: Number(row.completed_count), failed: Number(row.failed_count) },
          latestAnalyses
        };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    }
  };
}
