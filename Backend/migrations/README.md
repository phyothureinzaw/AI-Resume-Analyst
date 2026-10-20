# Authentication migration

Checkpoint 2 adds `001_add_auth_sessions.sql`. Apply it once to the existing development database after reviewing it. It only creates the new session table and indexes; it does not recreate or alter existing tables.

From Windows CMD, with PostgreSQL's `psql` available:

```cmd
cd /d "C:\Users\User\Desktop\MINE\PERSONAL PROJECT\Resume Analyst\Backend"
psql -h localhost -p 5432 -U resume_match_app -d resume_match_db -f migrations\001_add_auth_sessions.sql
```

If `DATABASE_URL` is only stored in `.env`, use pgAdmin's Query Tool to run the migration file instead. Never paste the connection password into source control.

Expired-session cleanup is safe and read-only verification is separate. When cleanup is needed, run:

```sql
DELETE FROM auth_sessions WHERE expires_at <= now();
```

This cleanup is intentionally manual in Checkpoint 2 and should be scheduled by the deployment environment later.
