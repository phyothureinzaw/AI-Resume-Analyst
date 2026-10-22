-- IP-1 interview preparation storage. Forward-only; preserves existing tables/data.
-- Rollback is intentionally manual because dropping this table would remove
-- preparation history and cascade-deletion records.
BEGIN;

CREATE TABLE interview_preparations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  job_description_id UUID NOT NULL,
  resume_id UUID,
  request_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  job_title_snapshot VARCHAR(150) NOT NULL,
  company_name_snapshot VARCHAR(150),
  resume_title_snapshot VARCHAR(150),
  job_text_snapshot TEXT NOT NULL,
  resume_text_snapshot TEXT,
  result JSONB,
  model_name TEXT,
  prompt_version TEXT NOT NULL,
  result_schema_version TEXT NOT NULL,
  error_code TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lease_expires_at TIMESTAMPTZ,
  claim_token UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT uq_interview_preparations_user_request UNIQUE (user_id, request_id),
  CONSTRAINT fk_interview_preparations_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_interview_preparations_job_user FOREIGN KEY (job_description_id, user_id) REFERENCES job_descriptions(id, user_id) ON DELETE CASCADE,
  CONSTRAINT fk_interview_preparations_resume_user FOREIGN KEY (resume_id, user_id) REFERENCES resumes(id, user_id) ON DELETE CASCADE,
  CONSTRAINT ck_interview_preparations_status CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  CONSTRAINT ck_interview_preparations_job_text CHECK (btrim(job_text_snapshot) <> ''),
  CONSTRAINT ck_interview_preparations_resume_snapshot CHECK ((resume_id IS NULL AND resume_title_snapshot IS NULL AND resume_text_snapshot IS NULL) OR (resume_id IS NOT NULL AND resume_title_snapshot IS NOT NULL AND resume_text_snapshot IS NOT NULL AND btrim(resume_text_snapshot) <> '')),
  CONSTRAINT ck_interview_preparations_result_object CHECK (result IS NULL OR jsonb_typeof(result) = 'object'),
  CONSTRAINT ck_interview_preparations_completed CHECK ((status = 'completed' AND result IS NOT NULL AND completed_at IS NOT NULL) OR status <> 'completed'),
  CONSTRAINT ck_interview_preparations_failed CHECK ((status = 'failed' AND error_code IS NOT NULL AND btrim(error_code) <> '' AND completed_at IS NOT NULL) OR status <> 'failed'),
  CONSTRAINT ck_interview_preparations_open_completed_at CHECK ((status IN ('pending', 'processing') AND completed_at IS NULL) OR status IN ('completed', 'failed')),
  CONSTRAINT ck_interview_preparations_attempt_count CHECK (attempt_count >= 0),
  CONSTRAINT ck_interview_preparations_claim_fields CHECK ((status = 'processing' AND claim_token IS NOT NULL AND lease_expires_at IS NOT NULL) OR (status <> 'processing' AND claim_token IS NULL AND lease_expires_at IS NULL))
);

CREATE INDEX ix_interview_preparations_user_created ON interview_preparations (user_id, created_at DESC, id DESC);
CREATE INDEX ix_interview_preparations_user_status ON interview_preparations (user_id, status, created_at DESC, id DESC);
CREATE INDEX ix_interview_preparations_job ON interview_preparations (job_description_id, user_id);
CREATE INDEX ix_interview_preparations_resume ON interview_preparations (resume_id, user_id) WHERE resume_id IS NOT NULL;
CREATE INDEX ix_interview_preparations_queue ON interview_preparations (next_attempt_at, created_at, id) WHERE status IN ('pending', 'processing');

COMMIT;
