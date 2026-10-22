import type { InterviewPreparationStatus } from './interview-preparation.schema.js';

export type InterviewPreparationRow = {
  id: string; user_id: string; job_description_id: string; resume_id: string | null; request_id: string; status: InterviewPreparationStatus;
  job_title_snapshot: string; company_name_snapshot: string | null; resume_title_snapshot: string | null; job_text_snapshot: string; resume_text_snapshot: string | null;
  result: Record<string, unknown> | null; model_name: string | null; prompt_version: string; result_schema_version: string; error_code: string | null;
  attempt_count: number; next_attempt_at: Date; lease_expires_at: Date | null; claim_token: string | null; created_at: Date; completed_at: Date | null;
};

export type InterviewPreparationSummary = Pick<InterviewPreparationRow, 'id' | 'job_description_id' | 'resume_id' | 'job_title_snapshot' | 'company_name_snapshot' | 'resume_title_snapshot' | 'status' | 'created_at' | 'completed_at'>;
