Here’s a single, copy-pasteable **spec + instruction prompt** you can give to an LLM to generate the entire app. It’s deliberately explicit so the model produces a working, Dockerized system on your Beelink with a minimal but usable UI and ntfy delivery.

---

# ROLE & OBJECTIVE

You are a senior full-stack engineer. Produce a complete, production-ready implementation of a small multi-user “Family Reminders” web app that:

* lets family members create users (each with their own ntfy topic + timezone),
* lets them create reminders using cron syntax,
* schedules and delivers notifications via ntfy to the user’s topic at the correct local time,
* runs as Dockerized services on a home server (Beelink) behind a reverse proxy,
* exposes a minimal, clean web UI,
* is easy to start with `docker compose up -d`.

Deliver **working code**, infra configs, and concise docs. Favor simplicity and reliability over frameworks and magic.

# CONTEXT (ENVIRONMENT & HOST)

* Home server: Linux (Debian/Ubuntu-like), accessible at `192.168.1.185` on the LAN.
* The server is always on and can run Docker containers.
* We will access the app via browser on the same LAN.
* We may later put a real domain/HTTPS, but for v1 we’re fine with plain HTTP on LAN.

# HIGH-LEVEL ARCHITECTURE

Create a multi-container app using Docker Compose:

1. **proxy**: Caddy reverse proxy listening on `:80`.

   * Routes:

     * `/` → the frontend (Next.js)
     * `/api/*`, `/openapi.json`, `/docs`, `/redoc` → FastAPI
     * `/push/*` → ntfy
   * Minimal config; ready to swap to domain + HTTPS later.

2. **web**: Next.js 14 + React 18 + Tailwind; shadcn/ui optional but not required.

   * Pages:

     * `/` home/links
     * `/users` manage users
     * `/new` create a reminder
   * Calls the API at **relative path** `/api` (Very Important: use `NEXT_PUBLIC_API_BASE=/api` to avoid “Fail to fetch”).

3. **api**: FastAPI (Python 3.12) + SQLAlchemy + Pydantic.

   * Endpoints for users and reminders (CRUD minimal for v1).
   * Exposes `/health` returning `{ "ok": true }`.
   * Creates database tables on startup (idempotent).
   * No heavy auth for v1.

4. **scheduler**: separate Python process using APScheduler.

   * Rebuilds jobs every 60s by querying the DB for enabled reminders.
   * Triggers reminders using cron expressions in the user’s timezone.
   * When a reminder fires, POSTs to ntfy topic with Title/Body.

5. **db**: Postgres 16 with a volume for persistence.

6. **ntfy**: Official ntfy server container, proxied at `/push`.

   * v1 uses open topics; later we can enable auth.
   * Messages are sent by scheduler to `NTFY_BASE_URL/{topic}`.

# TECH CHOICES & VERSIONS

* Python: 3.12 (slim image), FastAPI ≥ 0.115, Uvicorn standard workers.
* SQLAlchemy 2.x, psycopg 3.x.
* APScheduler 3.10.x with CronTrigger.
* Node 22 Alpine for Next.js build/runtime.
* TailwindCSS; lucide-react icons optional.
* Docker Compose v3.9+ file.
* Caddy 2 image.

# DATA MODEL (MINIMAL)

* `User { id, name (unique), ntfy_topic, timezone (IANA string, default America/Vancouver) }`
* `Reminder { id, user_id (FK), title, body (text, optional), cron (string), enabled (bool, default true), created_at }`
* `DeliveryLog { id, reminder_id (FK), sent_at (now), status (string: "sent"|"error"), detail (text) }`

# API CONTRACT (JSON over HTTP)

Base path `/api`. All responses JSON; on errors return structured JSON with `detail`.

* `GET /health` → `{ "ok": true }`
* **Users**

  * `POST /users` → create user `{ name, ntfy_topic, timezone? }` → returns full user with `id`
  * `GET /users` → list users
* **Reminders**

  * `POST /reminders` → `{ user_id, title, body?, cron }` → returns created reminder `{ id, user_id, title, body, cron, enabled }`
  * `GET /reminders?user_id=` → list reminders (optionally filtered by user)
  * (Optional for v1) `DELETE /reminders/{id}` → remove + unschedule
* (Optional) `GET /openapi.json`, `/docs`, `/redoc` included by FastAPI.

# SCHEDULER BEHAVIOR

* Loop every 60s:

  * Fetch all enabled reminders.
  * Register/refresh one APScheduler CronTrigger per reminder using the **user’s timezone** (DST aware).
* On trigger:

  * Build message `{title, body}`.
  * Send HTTP POST to `NTFY_BASE_URL/{user.ntfy_topic}` with `Title` header set to reminder title and body as payload.
  * On success: insert DeliveryLog(status=sent). On failure: status=error + detail (HTTP code/message).
* Start scheduler immediately on container start; log each registration cycle count and each delivery attempt.

# FRONTEND (NEXT.JS) REQUIREMENTS

* Use app router.
* Minimal pages:

  * `/`: title + links to `/users` and `/new`.
  * `/users`: form to create user (name, ntfy\_topic, timezone), list users after creation.
  * `/new`: form to create reminder (select user from `/api/users`, fields for title, optional body, cron).
* **Config**: fetch base URL from `process.env.NEXT_PUBLIC_API_BASE`, default to `/api`.
* UX niceties:

  * After creating a user, reload list.
  * After creating a reminder, show toast/alert “Created. Scheduler will pick it up within a minute.”
  * Helpful text under cron input with 2–3 examples.
* Do not require shadcn components; plain Tailwind is fine (but structure it so shadcn could be added later).

# ENV & CONFIG

Create a `.env` at project root with:

* `TZ=America/Vancouver`
* `DOMAIN=192.168.1.185` (LAN)
* `PUBLIC_BASE_URL=http://192.168.1.185`
* `POSTGRES_DB=reminders`
* `POSTGRES_USER=reminders`
* `POSTGRES_PASSWORD=<choose-strong>`
* `DATABASE_URL=postgresql+psycopg://reminders:<password>@db:5432/reminders`
* `NTFY_BASE_URL=http://ntfy` (inside Docker, scheduler/API talk to the ntfy container)
* `JWT_SECRET=<any string>` (reserved for future; not used for v1)
* `NEXT_PUBLIC_API_BASE=/api` (critical: **relative path**)

# DOCKER COMPOSE REQUIREMENTS

* Services: `proxy` (Caddy), `web` (Next.js), `api` (FastAPI), `scheduler` (same image as API but different command), `db` (Postgres), `ntfy` (ntfy server).
* Volumes: Postgres data, ntfy data, Caddy data/config.
* Dependencies: `web` depends on `api`; `api`/`scheduler` depend on `db`; `proxy` depends on `web` and `api`.
* Expose only port 80 on the host in v1.

# CADDYFILE REQUIREMENTS

* Site block `:80`.
* Matchers:

  * `@api path /api/* /openapi.json /docs /redoc` → `reverse_proxy api:8000`
  * `handle_path /push/*` → `reverse_proxy ntfy:80`
  * default `handle` → `reverse_proxy web:3000`
* Ready to change to domain + automatic TLS later.

# QUALITY & DX REQUIREMENTS

* **Idempotent DB init**: create tables on API startup.
* **Logging**:

  * API: request log minimal, startup message, DB health check log.
  * Scheduler: log registration cycle and every send attempt (success/failure).
* **Error handling**:

  * API returns 400 on duplicate username, 404 on missing user, 422 on bad cron (validate format).
  * Scheduler catches ntfy errors and records in DeliveryLog.
* **Validation**:

  * `name` nonempty; `ntfy_topic` nonempty; `timezone` valid IANA (fallback default).
  * `cron` validated via library or a simple parse; on invalid, return 422 with message.
* **Timezones**: per user; CronTrigger uses the user’s tz; default `America/Vancouver`.
* **Security (v1)**: no login; assume trusted LAN. Keep code structured to add auth later.
* **Docs**: concise `README.md` with quickstart and test steps.

# ACCEPTANCE TESTS (MANUAL)

Provide a “Smoke Test” section in README:

1. `docker compose up -d` shows all services “Up”.
2. Visit `http://192.168.1.185/` loads home.
3. `http://192.168.1.185/api/health` returns `{ "ok": true }`.
4. Create user “Alex”, topic `family-alex`, tz `America/Vancouver`.
5. Subscribe to topic:

   * Browser: open `http://192.168.1.185/push/family-alex`, click subscribe, enable notifications; **or**
   * ntfy mobile app: add subscription to `http://192.168.1.185/push/family-alex`.
6. Create reminder for Alex: cron `*/2 * * * *` (every 2 minutes), title “Test”, body “Ping”.
7. Within \~2–3 minutes, device receives notification. Scheduler logs show a send event.
8. Create a daily reminder `0 18 * * *` and confirm it schedules (next run time visible in logs).

# REPO STRUCTURE (FILENAMES; FILL WITH CODE)

* `docker-compose.yml`
* `Caddyfile`
* `.env.example` and `.env` (do not commit secrets)
* `README.md`
* `api/`

  * `Dockerfile`
  * `requirements.txt`
  * `app/`

    * `config.py`
    * `db.py`
    * `models.py`
    * `schemas.py`
    * `ntfy.py`
    * `main.py` (FastAPI app & routes)
  * `scheduler_main.py` (APScheduler entrypoint)
* `web/`

  * `Dockerfile`
  * `package.json`
  * `next.config.js`
  * `postcss.config.js`
  * `tailwind.config.ts`
  * `app/`

    * `globals.css`
    * `page.tsx` (home)
    * `users/page.tsx`
    * `new/page.tsx`
  * (Optional later) shadcn init, components

# RUNTIME BEHAVIOR & INTEGRATION DETAILS

* **API base for frontend**: must be **relative** (`/api`). Never use `http://proxy/...` or container hostnames in browser code.
* **ntfy base for API/scheduler**: internal container URL `http://ntfy` (set via `NTFY_BASE_URL` env). For users’ subscription links, frontend shows `http://192.168.1.185/push/<topic>`.
* **Scheduler refresh**: 60s cycle; removes/readds jobs to reflect DB changes (cheap and robust).
* **Test command**:

  * `curl -d "hello" -H "Title: Test" http://192.168.1.185/push/family-alex` should display in browser/app immediately.

# OPTIONAL (IF TIME PERMITS)

* Add `DELETE /reminders/{id}` and unschedule.
* Add a basic `/logs?reminder_id=` endpoint to view recent DeliveryLogs.
* Seed script to create demo users/topics.
* Makefile with `make build`, `make up`, `make logs`.
* Basic cron presets in UI (dropdown) to avoid raw cron for non-technical users.

# DELIVERABLES

* All source files with complete, runnable code matching the structure above.
* Docker images build successfully; `docker compose up -d` runs all services.
* README with:

  * prerequisites (Docker/Compose),
  * setup steps (copy `.env.example` → `.env`, customize),
  * build/run commands,
  * LAN URLs,
  * testing instructions (including the 2-minute cron test),
  * troubleshooting (“Fail to fetch” → verify `NEXT_PUBLIC_API_BASE=/api`, check `/api/health`, view logs).

# NON-GOALS FOR V1

* No user authentication or authorization.
* No reminder edit UI (create and list are enough); delete optional.
* No email/SMS gateways; only ntfy push.
* No multi-tenant beyond family topics.

# STYLE & IMPLEMENTATION NOTES FOR YOU (LLM)

* Keep dependencies minimal and pinned.
* Use straightforward, readable code; small functions; explicit types.
* Validate inputs and return informative error messages.
* Prefer relative URLs in the frontend for API calls.
* Include comments where behavior is non-obvious (timezone handling, cron parsing).
* Make sure cold start works without manual DB migration commands.

---

**Produce the full codebase, all configs, and the README.** Avoid placeholders like “TODO”. After generating, include a short “Runbook” section at the end of the README with the exact commands to build, run, and smoke-test on `192.168.1.185`.
