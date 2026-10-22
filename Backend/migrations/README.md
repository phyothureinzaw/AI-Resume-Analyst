# Migrations

The current PostgreSQL database remains authoritative. Do not reset, truncate, or recreate it.

From Windows CMD, with PostgreSQL's `psql` available:

```cmd
cd /d "C:\Users\User\Desktop\MINE\PERSONAL PROJECT\Resume Analyst\Backend"
psql -h localhost -p 5432 -U resume_match_app -d resume_match_db -f migrations\001_add_auth_sessions.sql
psql -h localhost -p 5432 -U resume_match_app -d resume_match_db -f migrations\002_add_analysis_queue.sql
psql -h localhost -p 5432 -U resume_match_app -d resume_match_db -f migrations\003_add_interview_preparations.sql
```

Run each migration once, in filename order. If `DATABASE_URL` is only stored in `.env`, use pgAdmin's Query Tool instead. Never paste the connection password into source control.

`003_add_interview_preparations.sql` creates only the new `interview_preparations` table and indexes. It does not modify `resume_analyses` or existing source rows. Deleting a user, job description, or selected resume cascades to the associated preparation rows, including their idempotency records. The migration is forward-only; rollback requires a deliberate, separately reviewed `DROP TABLE interview_preparations` operation and would permanently remove preparation history.

`002_add_analysis_queue.sql` is forward-only and preserves existing rows. A legacy `processing` row is safely requeued as `pending` because it cannot have a valid claim token from the old schema.

Expired-session cleanup remains a separate manual operation:

```sql
DELETE FROM auth_sessions WHERE expires_at <= now();
```

## Read-only verification queries

These queries inspect ownership, dashboard-safe counts, and analysis status without selecting resume/job document contents or session tokens:

```sql
SELECT
  (SELECT COUNT(*) FROM resumes) AS resumes,
  (SELECT COUNT(*) FROM job_descriptions) AS jobs,
  (SELECT COUNT(*) FROM resume_analyses) AS analyses;
```

```sql
SELECT status, COUNT(*) AS total
FROM resume_analyses
GROUP BY status
ORDER BY status;
```

```sql
SELECT id, user_id, resume_id, job_description_id, status,
       match_score, created_at, completed_at
FROM resume_analyses
ORDER BY created_at DESC, id DESC
LIMIT 5;
```

Do not use `SELECT *` for verification because the analysis table contains stored text snapshots.

## Interview preparation verification

These read-only queries omit source snapshots and preparation results:

```sql
SELECT id, user_id, job_description_id, resume_id, request_id,
       status, job_title_snapshot, company_name_snapshot,
       resume_title_snapshot, attempt_count, created_at, completed_at
FROM interview_preparations
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'interview_preparations'
ORDER BY indexname;
```

```sql
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'public' AND table_name = 'interview_preparations'
ORDER BY constraint_name;
```

IP-1 stores new preparations as `pending`. IP-2 adds the separate `npm run interview-worker` generation worker. It claims only `interview_preparations`, uses stored snapshots, and persists a versioned validated result with 5 technical, 4 scenario, and 3 behavioral questions, study topics, and 4 interviewer questions. Job-only answers remain general; resume-personalized answers must use supported resume source segment IDs, and unsupported behavioral answers use explicit STAR placeholders. IP-2 does not add frontend pages; those are deferred to IP-3.
