# Migrations

The current PostgreSQL database remains authoritative. Do not reset, truncate, or recreate it.

From Windows CMD, with PostgreSQL's `psql` available:

```cmd
cd /d "C:\Users\User\Desktop\MINE\PERSONAL PROJECT\Resume Analyst\Backend"
psql -h localhost -p 5432 -U resume_match_app -d resume_match_db -f migrations\001_add_auth_sessions.sql
psql -h localhost -p 5432 -U resume_match_app -d resume_match_db -f migrations\002_add_analysis_queue.sql
```

Run each migration once, in filename order. If `DATABASE_URL` is only stored in `.env`, use pgAdmin's Query Tool instead. Never paste the connection password into source control.

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
