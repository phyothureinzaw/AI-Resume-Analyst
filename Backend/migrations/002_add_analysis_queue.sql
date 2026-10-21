-- Forward-only Checkpoint 5 queue fields. Apply once after 001_add_auth_sessions.sql.
ALTER TABLE resume_analyses
  ADD COLUMN IF NOT EXISTS request_id uuid,
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS claim_token uuid;

UPDATE resume_analyses
SET attempt_count = 0,
    next_attempt_at = COALESCE(next_attempt_at, created_at)
WHERE attempt_count IS NULL OR next_attempt_at IS NULL;

-- A pre-existing processing row has no claim token in the old schema. Requeue it
-- safely so the new worker can claim it instead of accepting an un-fenced update.
UPDATE resume_analyses
SET status = 'pending', lease_expires_at = NULL, claim_token = NULL,
    next_attempt_at = now()
WHERE status = 'processing';

ALTER TABLE resume_analyses
  ADD CONSTRAINT ck_analyses_attempt_count CHECK (attempt_count >= 0),
  ADD CONSTRAINT ck_analyses_claim_fields CHECK (
    (status = 'processing' AND claim_token IS NOT NULL AND lease_expires_at IS NOT NULL)
    OR (status <> 'processing' AND claim_token IS NULL AND lease_expires_at IS NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS ux_analyses_user_request
  ON resume_analyses (user_id, request_id)
  WHERE request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_analyses_queue
  ON resume_analyses (next_attempt_at, created_at, id)
  WHERE status IN ('pending', 'processing');
