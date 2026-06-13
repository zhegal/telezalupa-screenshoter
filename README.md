# TV Screenshoter

NestJS + TypeScript worker that loads JSON playlists, selects an available channel, captures a frame with ffmpeg, and sends it to Telegram.

## Requirements

- Node.js 20+
- npm
- ffmpeg installed locally
- Docker optional

## Configuration

Copy `.env.example` to `.env` and fill in:

```env
TELEGRAM_BOT_TOKEN=
TELEGRAM_DEFAULT_CHAT_ID=
TEMP_ADMIN_PASSWORD=
PORT=3000

POSTGRES_DB=tv_screenshoter
POSTGRES_USER=tv_screenshoter
POSTGRES_PASSWORD=change_me
DATABASE_URL=postgresql://tv_screenshoter:change_me@localhost:5432/tv_screenshoter?schema=public
```

Temporary playlist sources live in `data/playlists.json`. This file is intentionally simple and will later be replaced by PostgreSQL/admin configuration.

`TEMP_ADMIN_PASSWORD` is required only while the database has no users. The first login is:

- login: `admin`
- password: the value of `TEMP_ADMIN_PASSWORD`

After logging in as the temporary admin, open `/setup` and create the first real admin profile. Once the first user exists, the temporary `admin` login is disabled and `/setup` behaves like a missing route.

`/api/health` remains public and does not require authentication.

## Local Run

Backend dev server:

```bash
npm install
npm run dev:backend
```

Frontend dev server:

```bash
npm run dev:frontend
```

The Vite dev server proxies `/api` to the NestJS backend on `http://127.0.0.1:3000`.

For non-Docker backend development, PostgreSQL must be reachable via `DATABASE_URL`.

Production build and run:

```bash
npm run build
npm run start:prod
```

`npm run start:prod` runs `prisma migrate deploy` before starting NestJS. If the database is unavailable or migrations cannot be applied, the app exits instead of running in a partial state.

Health check:

```bash
curl http://localhost:3000/api/health
```

The admin frontend is served from `/`. Backend API routes live under `/api`.

## Frontend

The Vue 3 admin shell lives in `frontend/`.

- Vite builds static assets into `dist/public`.
- NestJS serves the built frontend from `/` in production.
- Vue Router uses history mode, so direct frontend routes such as `/settings` are handled by NestJS fallback serving.
- Frontend API calls use relative `/api/...` paths.
- Auth uses an HttpOnly session cookie. The browser does not store tokens.

## Prisma

Prisma schema and migrations live in `prisma/`.

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:deploy
npm run prisma:studio
```

The first migration creates `users` and `sessions`. Sessions are stored server-side in PostgreSQL, last 30 days, and are extended on authenticated activity.

## Docker

Local development compose publishes the app port to the host:

```bash
docker compose up -d --build
```

Local compose starts both `screenshoter` and `postgres`. PostgreSQL uses the named volume `postgres_data` and does not publish a database port to the host. `DATABASE_URL` is assembled by compose automatically from `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD`.

Production compose is intended for VPS usage behind Nginx Proxy Manager. It does not publish backend or PostgreSQL ports to the host; it exposes backend port `3000` only inside Docker networks.

```bash
docker compose -f docker-compose.production.yml up -d --build
```

Nginx Proxy Manager should be attached to the same external `proxy` network and can reach the backend by service/container name `screenshoter` on port `3000`.

In production compose:

- `screenshoter` is attached to the external `proxy` network and an internal network.
- `postgres` is attached only to the internal network.
- PostgreSQL data is stored in the named volume `postgres_data`.
