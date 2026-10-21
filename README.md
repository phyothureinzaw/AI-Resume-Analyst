# AI Resume Analyzer & Job Matching Platform

Checkpoint 5 adds a PostgreSQL-backed Gemini analysis queue, deterministic requirement coverage scoring, evidence validation, a separate worker, and protected analysis frontend routes. Resume management, bounded PDF extraction, and job-description management remain available.

Checkpoint 6 adds a protected, user-scoped dashboard at `/dashboard` and `GET /api/dashboard`. The endpoint returns resume, job, and analysis counts, status counts, and the five newest analysis summaries. It never returns document text, report JSON, session data, or queue claim fields. The supported-input contract and synthetic hardening matrix are documented in `docs/analysis-hardening.md`.

## Architecture

- `Backend`: strict TypeScript Express API with a single `pg` pool, request IDs, structured logging, centralized errors, health endpoints, Argon2id password hashing, and PostgreSQL-backed opaque sessions.
- `Frontend`: Vite React TypeScript app with React Router, TanStack Query, Tailwind CSS, a typed credentialed API client, and protected routes.
- `Database`: the existing PostgreSQL schema remains authoritative. The existing `job_descriptions`, `resumes`, and `resume_analyses` tables were inspected read-only. Checkpoint 5 adds the forward-only `Backend/migrations/002_add_analysis_queue.sql` queue migration.

## Database workflow

The current database remains authoritative. Apply `001_add_auth_sessions.sql` and then `002_add_analysis_queue.sql` once before using authentication and analysis. Neither migration resets or recreates existing tables. See `Backend/migrations/README.md` for the Windows workflow. For a fresh database, first provision the project's supplied baseline schema for `users`, `resumes`, `job_descriptions`, and `resume_analyses`; this repository does not include a baseline-create migration, so do not invent one or run the checkpoint migrations against an empty database.

Sessions expire after `SESSION_TTL_DAYS` (default 7). The session cookie is HttpOnly, Path=/, SameSite=Lax, and Secure only in production. The CSRF token is a separate readable cookie plus request header; state-changing auth requests also validate the configured Origin. Local development supports the frontend at `http://localhost:5173` and backend at `http://localhost:4000` with credentialed CORS. The rate limiter uses an in-memory single-instance store and should be replaced with a shared store before multi-instance deployment.

## Windows CMD commands

From the repository root in Windows CMD:

```cmd
cd Backend
npm install
copy /Y .env.example .env
npm run dev
```

In a second CMD window:

```cmd
cd Frontend
npm install
copy /Y .env.example .env
npm run dev
```

Run the worker in a third CMD window:

```cmd
cd /d "C:\Users\User\Desktop\MINE\PERSONAL PROJECT\Resume Analyst\Backend"
npm run worker
```

Production checks:

```cmd
cd Backend
npm run typecheck
npm run lint
npm test
npm run build
npm start
```

```cmd
cd Frontend
npm run typecheck
npm run lint
npm run build
npm run preview
```

The backend defaults to `http://localhost:4000`; the frontend defaults to `http://localhost:5173`; the frontend API defaults to `http://localhost:4000/api`. Open `http://localhost:5173/dashboard` after signing in. Readiness is `http://localhost:4000/api/health/ready`.

The backend `.env` must contain the local PostgreSQL `DATABASE_URL`, `CORS_ORIGIN=http://localhost:5173`, and a Gemini key for worker processing. Keep real values only in `.env`; `.env.example` contains placeholders. The configured Gemini service receives the resume and job snapshots needed for an analysis. Do not place credentials or unrelated sensitive information in resume/job text.

## Authentication endpoints

- `GET /api/auth/csrf` returns a CSRF token and sets its cookie.
- `POST /api/auth/register` creates an account without logging in.
- `POST /api/auth/login` creates an opaque server-side session.
- `POST /api/auth/logout` revokes the current session.
- `GET /api/auth/me` returns the safe current-user DTO.

## Dashboard endpoint

`GET /api/dashboard` requires the HttpOnly session cookie. It returns:

```json
{
  "dashboard": {
    "counts": { "resumes": 0, "jobs": 0, "analyses": 0 },
    "analysisStatuses": { "pending": 0, "processing": 0, "completed": 0, "failed": 0 },
    "latestAnalyses": []
  }
}
```

Latest rows contain only owned resume/job IDs and titles, status, completed score, and created/completed timestamps. They are ordered by `created_at DESC, id DESC`. The counts and latest rows are read in one transaction.

## Resume endpoints

- `GET /api/resumes?page=1&pageSize=10&search=` lists only the signed-in user’s resume metadata.
- `POST /api/resumes` creates a resume from reviewed `title` and `resumeText` JSON.
- `POST /api/resumes/extract` accepts exactly one `file` PDF multipart upload, up to 5 MiB, and returns extracted text without saving the PDF or creating a row.
- `GET /api/resumes/:id` returns one owned resume, including text.
- `PATCH /api/resumes/:id` edits the title and/or text.
- `DELETE /api/resumes/:id` deletes the owned resume and any dependent analysis rows through the existing database cascade.

PDF extraction is intentionally text-only: encrypted, corrupt, image-only/scanned, unsupported, oversized, and overlong-output files return clear errors. Extraction runs in a bounded worker and does not log uploaded text.

The original PDF is discarded after extraction; only the explicitly reviewed text is saved. Uploads are limited to one `application/pdf` file up to 5 MiB. The analysis score is weighted requirement coverage: required requirements have weight 2, preferred requirements weight 1; supported evidence earns full weight, partial evidence earns half, and not-evidenced earns zero. This is a comparison aid, not a hiring probability or universal ATS score.

## Job endpoints

- `GET /api/jobs?page=1&pageSize=10&search=` lists only the signed-in user’s job summaries.
- `POST /api/jobs` creates a job from `jobTitle`, optional `companyName`, and `descriptionText` JSON.
- `GET /api/jobs/:id` returns one owned job with its description.
- `PATCH /api/jobs/:id` edits the allowed job fields, including clearing the company with `null`.
- `DELETE /api/jobs/:id` deletes the owned job and linked analyses through the existing database cascade.

## Analysis worker behavior

`POST /api/analyses` creates a pending row and returns `202`. Start `npm run worker` separately. The worker leases rows, retries transient/rate-limit failures up to `ANALYSIS_MAX_ATTEMPTS`, and marks non-retryable provider or validation failures as `failed`. A process crash can result in a repeat provider call after the lease expires; request IDs prevent duplicate enqueueing for a replayed creation request. Failed analyses remain historical records and are not silently requeued.

## Troubleshooting

- `DATABASE_UNAVAILABLE`: check PostgreSQL is running and the local `DATABASE_URL`; apply migrations in filename order without resetting the database.
- `401 Authentication required`: sign in again; expired sessions are rejected and private queries are not restored after logout.
- `403 CSRF_INVALID`: obtain `/api/auth/csrf` through the frontend and keep the returned token cookie/header pairing; do not disable CSRF.
- Analysis remains pending: start the separate worker and confirm its startup log model matches `.env`.
- Gemini invalid request/model/quota errors: inspect sanitized worker metadata (`providerHttpStatus`, `providerStatus`, `providerMessage`); never log keys or document text. Confirm the configured model is available to the account.
- PDF extraction failure: use a text-based, unencrypted PDF under 5 MiB, or paste reviewed text instead.
- Frontend API unavailable: confirm the backend is listening on port 4000 and `Frontend/.env` points `VITE_API_BASE_URL` to `http://localhost:4000/api`.
