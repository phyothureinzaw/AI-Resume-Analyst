import type { Pool } from 'pg';
import type { ResumeInput, ResumePatch, ResumeRow, ResumeSummary } from './resumes.types.js';

export function createResumesRepository(pool: Pool) {
  return {
    async create(userId: string, input: ResumeInput): Promise<ResumeRow> {
      const result = await pool.query<ResumeRow>('INSERT INTO resumes (user_id, title, resume_text) VALUES ($1, $2, $3) RETURNING id, user_id, title, original_file_name, storage_key, file_size_bytes, resume_text, created_at, updated_at', [userId, input.title, input.resumeText]);
      return result.rows[0]!;
    },
    async list(userId: string, page: number, pageSize: number, search: string): Promise<{ items: ResumeSummary[]; total: number }> {
      const offset = (page - 1) * pageSize;
      const count = await pool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM resumes WHERE user_id = $1 AND ($2 = $3 OR title ILIKE $4)', [userId, search, '', `%${search}%`]);
      const rows = await pool.query<ResumeSummary>('SELECT id, user_id, title, original_file_name, storage_key, file_size_bytes, created_at, updated_at FROM resumes WHERE user_id = $1 AND ($2 = $3 OR title ILIKE $4) ORDER BY created_at DESC, id DESC LIMIT $5 OFFSET $6', [userId, search, '', `%${search}%`, pageSize, offset]);
      return { items: rows.rows, total: Number(count.rows[0]?.count ?? 0) };
    },
    async findById(userId: string, id: string): Promise<ResumeRow | null> {
      const result = await pool.query<ResumeRow>('SELECT id, user_id, title, original_file_name, storage_key, file_size_bytes, resume_text, created_at, updated_at FROM resumes WHERE id = $1 AND user_id = $2', [id, userId]);
      return result.rows[0] ?? null;
    },
    async update(userId: string, id: string, patch: ResumePatch): Promise<ResumeRow | null> {
      const result = await pool.query<ResumeRow>('UPDATE resumes SET title = COALESCE($1, title), resume_text = COALESCE($2, resume_text) WHERE id = $3 AND user_id = $4 RETURNING id, user_id, title, original_file_name, storage_key, file_size_bytes, resume_text, created_at, updated_at', [patch.title ?? null, patch.resumeText ?? null, id, userId]);
      return result.rows[0] ?? null;
    },
    async remove(userId: string, id: string): Promise<boolean> {
      const result = await pool.query('DELETE FROM resumes WHERE id = $1 AND user_id = $2', [id, userId]);
      return result.rowCount === 1;
    }
  };
}
