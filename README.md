# AI Resume Analyzer & Job Matching Platform

Checkpoint 3 adds owned resume CRUD, search/pagination, paste-and-review creation, bounded PDF text extraction, and protected resume frontend routes. Job CRUD and AI analysis remain out of scope.

## Architecture

- `Backend`: strict TypeScript Express API with a single `pg` pool, request IDs, structured logging, centralized errors, health endpoints, Argon2id password hashing, and PostgreSQL-backed opaque sessions.
- `Frontend`: Vite React TypeScript app with React Router, TanStack Query, Tailwind CSS, a typed credentialed API client, and protected routes.
- `Database`: the existing PostgreSQL schema remains authoritative. The existing `resumes` and `resume_analyses` tables were inspected read-only; no schema-changing SQL is needed for this checkpoint.

## Database workflow

The current database remains authoritative. Checkpoint 2 adds the versioned `Backend/migrations/001_add_auth_sessions.sql` migration; it does not recreate or alter the existing tables. Apply it once before using authentication. Checkpoint 3 does not add a migration. See `Backend/migrations/README.md` for the Windows workflow and expired-session cleanup.

Sessions expire after `SESSION_TTL_DAYS` (default 7). The session cookie is HttpOnly, Path=/, SameSite=Lax, and Secure only in production. The CSRF token is a separate readable cookie plus request header; state-changing auth requests also validate the configured Origin. Local development supports the frontend at `http://localhost:5173` and backend at `http://localhost:4000` with credentialed CORS. The rate limiter uses an in-memory single-instance store and should be replaced with a shared store before multi-instance deployment.

## Windows CMD commands

From the repository root:

```cmd
cd Backend
npm install
copy .env.example .env
npm run dev
```

In a second CMD window:

```cmd
cd Frontend
npm install
copy .env.example .env
npm run dev
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

The backend defaults to `http://localhost:4000`; the frontend defaults to `http://localhost:4000/api`.

## Authentication endpoints

- `GET /api/auth/csrf` returns a CSRF token and sets its cookie.
- `POST /api/auth/register` creates an account without logging in.
- `POST /api/auth/login` creates an opaque server-side session.
- `POST /api/auth/logout` revokes the current session.
- `GET /api/auth/me` returns the safe current-user DTO.

## Resume endpoints

- `GET /api/resumes?page=1&pageSize=10&search=` lists only the signed-in user’s resume metadata.
- `POST /api/resumes` creates a resume from reviewed `title` and `resumeText` JSON.
- `POST /api/resumes/extract` accepts exactly one `file` PDF multipart upload, up to 5 MiB, and returns extracted text without saving the PDF or creating a row.
- `GET /api/resumes/:id` returns one owned resume, including text.
- `PATCH /api/resumes/:id` edits the title and/or text.
- `DELETE /api/resumes/:id` deletes the owned resume and any dependent analysis rows through the existing database cascade.

PDF extraction is intentionally text-only: encrypted, corrupt, image-only/scanned, unsupported, oversized, and overlong-output files return clear errors. Extraction runs in a bounded worker and does not log uploaded text.
