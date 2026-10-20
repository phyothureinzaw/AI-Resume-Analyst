import type { Pool } from 'pg';
import type { JobInput, JobPatch, JobRow, JobSummary } from './jobs.types.js';

function literalSearch(value: string): string { return value.replace(/[\\%_]/g, '\\$&'); }

export function createJobsRepository(pool: Pool) {
  return {
    async create(userId: string, input: JobInput): Promise<JobRow> {
      const result = await pool.query<JobRow>('INSERT INTO job_descriptions (user_id, job_title, company_name, description_text) VALUES ($1, $2, $3, $4) RETURNING id, user_id, job_title, company_name, description_text, created_at, updated_at', [userId, input.jobTitle, input.companyName, input.descriptionText]);
      return result.rows[0]!;
    },
    async list(userId: string, page: number, pageSize: number, search: string): Promise<{ items: JobSummary[]; total: number }> {
      const offset = (page - 1) * pageSize;
      const pattern = `%${literalSearch(search)}%`;
      const filter = '($2 = $3 OR job_title ILIKE $4 ESCAPE \'\\\' OR company_name ILIKE $4 ESCAPE \'\\\')';
      const count = await pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM job_descriptions WHERE user_id = $1 AND ${filter}`, [userId, search, '', pattern]);
      const rows = await pool.query<JobSummary>(`SELECT id, job_title, company_name, created_at, updated_at FROM job_descriptions WHERE user_id = $1 AND ${filter} ORDER BY created_at DESC, id DESC LIMIT $5 OFFSET $6`, [userId, search, '', pattern, pageSize, offset]);
      return { items: rows.rows, total: Number(count.rows[0]?.count ?? 0) };
    },
    async findById(userId: string, id: string): Promise<JobRow | null> {
      const result = await pool.query<JobRow>('SELECT id, user_id, job_title, company_name, description_text, created_at, updated_at FROM job_descriptions WHERE id = $1 AND user_id = $2', [id, userId]);
      return result.rows[0] ?? null;
    },
    async update(userId: string, id: string, patch: JobPatch): Promise<JobRow | null> {
      const values: unknown[] = [];
      const sets: string[] = [];
      for (const [column, value] of [['job_title', patch.jobTitle], ['company_name', patch.companyName], ['description_text', patch.descriptionText]] as const) {
        if (value !== undefined) { values.push(value); sets.push(`${column} = $${values.length}`); }
      }
      values.push(id, userId);
      const result = await pool.query<JobRow>(`UPDATE job_descriptions SET ${sets.join(', ')} WHERE id = $${values.length - 1} AND user_id = $${values.length} RETURNING id, user_id, job_title, company_name, description_text, created_at, updated_at`, values);
      return result.rows[0] ?? null;
    },
    async remove(userId: string, id: string): Promise<boolean> {
      const result = await pool.query('DELETE FROM job_descriptions WHERE id = $1 AND user_id = $2', [id, userId]);
      return result.rowCount === 1;
    }
  };
}
