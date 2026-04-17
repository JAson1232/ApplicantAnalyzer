# ApplicantAnalyser

ApplicantAnalyser is a full-stack admissions workflow app where universities publish degree listings, applicants submit PDF documents, and the backend scores applications with AI using hidden criteria.

## Prerequisites

- Docker Engine
- Docker Compose (v2)
- Anthropic API key (for Claude scoring)
- Google Gemini API key (for Gemini scoring)

## Quick start

1. Clone the repository.
2. Copy environment variables:
   ```bash
   cp .env.example .env
   ```
3. Fill in real values in `.env` (the `.env.example` values are placeholders), especially:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `ANTHROPIC_API_KEY`
   - `GEMINI_API_KEY`
   - `UPLOAD_DIR` (use `/app/uploads` for Docker)
4. Start the stack:
   ```bash
   make up
   ```
5. Seed demo data:
   ```bash
   make seed
   ```
6. Open `http://localhost:${NGINX_PORT:-80}`.

## Seeded demo credentials

- University user: `admissions@northbridge.ac.uk` / `UniDemo123!`
- Applicant user: `alex.morgan@example.com` / `ApplicantDemo123!`

Seeded data includes two degree listings and one pre-scored application.

## Architecture

```text
                +-------------------+
Browser  <----> | Nginx (port 80)   |
                +----+---------+----+
                     |         |
                 /api|         |/
                     v         v
             +-----------+  +-----------+
             | Backend   |  | Frontend  |
             | Node/Expr |  | Vite/React|
             | port 4000 |  | port 3000 |
             +-----+-----+  +-----------+
                   |
                   v
             +-----------+
             | Postgres  |
             | port 5432 |
             +-----------+
```

## Security notes

- `.env.example` contains placeholders only. Keep real secrets in `.env` and do not commit them.
- `hidden_criteria` is only exposed on university-owned degree endpoints; applicant endpoints never return it.
- Upload validation enforces PDF-only files and max size of 10MB per file.
- JWT authentication is required on all protected applicant/university routes.
- Passwords are bcrypt-hashed at registration and in seeding.
- Scoring trigger endpoint (`/api/score/...`) is university-only, so applicants cannot call scoring directly.
- New applications stay queued as `awaiting_model_selection` until admissions chooses Anthropic or Google and queues scoring.
- Admissions can cancel a pending scoring run and requeue with a different model if needed.
