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
