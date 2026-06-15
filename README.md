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

All runtime/status endpoints below require the HttpOnly auth session cookie.

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

## Runtime API

The worker still uses `data/playlists.json` and loaded JSON playlist cache as the source of playlists and channels. PostgreSQL currently stores auth/session data only; moving playlist/channel management to PostgreSQL is a separate future stage.

Public:

```txt
GET /api/health
```

Authenticated:

```txt
GET  /api/system/status
GET  /api/worker/status
POST /api/worker/start
POST /api/worker/stop
POST /api/worker/restart
POST /api/worker/run-once
GET  /api/runtime/playlists
GET  /api/runtime/channels
GET  /api/logs/recent
```

Worker controls:

- `start` starts the in-process worker if it is stopped and returns the current status if it is already running.
- `stop` cancels future scheduled cycles without killing an active ffmpeg/Telegram operation.
- `restart` stops scheduling, clears safe runtime queues/status cache, reloads the current JSON playlist sources, and starts the worker again.
- `run-once` runs one manual cycle with the same channel selection logic. If a cycle is already active, it returns `busy`.

Runtime views:

- `/playlists` shows read-only runtime playlist state from `data/playlists.json` and in-memory cache.
- `/channels` shows read-only channels from loaded JSON playlists, with search and filters for availability/errors.
- `/worker` shows detailed worker status and worker logs.
- `/logs` shows the in-memory runtime log ring buffer for the last 48 hours.

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

The catalog migration adds future database-source entities:

- `Provider`
- `Stream`
- `Channel`
- `Playlist`
- `PlaylistChannel`
- `ChannelStream`
- `TimezonePreset`
- `ChannelTimezone`
- `PlaylistTimezone`
- `TelegramChat`
- `CaptionTemplate`

These tables are available for preparing the future database-backed worker. The current worker still reads `data/playlists.json`; JSON import, bulk stream normalization, provider matching, and switching the worker to PostgreSQL are separate future stages.

## Database Catalog

The admin UI includes `/catalog`, a protected database catalog section. It is intentionally separate from the current runtime views:

- `/playlists` and `/channels` show the active JSON/runtime worker state.
- `/catalog` edits PostgreSQL catalog records that are not used by the worker yet.

Catalog API endpoints are authenticated and live under `/api/catalog/...`:

```txt
/api/catalog/providers
/api/catalog/streams
/api/catalog/channels
/api/catalog/playlists
/api/catalog/timezones
/api/catalog/telegram-chats
/api/catalog/caption-templates
```

Each catalog endpoint supports simple CRUD:

```txt
GET    /api/catalog/:entity
GET    /api/catalog/:entity/:id
POST   /api/catalog/:entity
PATCH  /api/catalog/:entity/:id
DELETE /api/catalog/:entity/:id
```

Basic list query params:

```txt
search
enabled
limit
offset
```

Relationship endpoints:

```txt
GET    /api/catalog/playlists/:id/channels
POST   /api/catalog/playlists/:id/channels
PATCH  /api/catalog/playlists/:id/channels/:relationId
DELETE /api/catalog/playlists/:id/channels/:relationId

GET    /api/catalog/channels/:id/streams
POST   /api/catalog/channels/:id/streams
PATCH  /api/catalog/channels/:id/streams/:relationId
DELETE /api/catalog/channels/:id/streams/:relationId

GET    /api/catalog/channels/:id/timezones
POST   /api/catalog/channels/:id/timezones
PATCH  /api/catalog/channels/:id/timezones/:relationId
DELETE /api/catalog/channels/:id/timezones/:relationId

GET    /api/catalog/playlists/:id/timezones
POST   /api/catalog/playlists/:id/timezones
PATCH  /api/catalog/playlists/:id/timezones/:relationId
DELETE /api/catalog/playlists/:id/timezones/:relationId
```

Current validation rules:

- `Provider.urlTemplate` must contain `{streamKey}`.
- `Stream` with `providerId` requires `streamKey`.
- `Stream` without `providerId` requires `directUrl`.
- Channel titles are not unique.
- Stream URLs and stream keys are not unique.
- Timezone presets may share the same timezone with different labels.

## Bulk Catalog Tools

The `/catalog` UI includes bulk tools for preparing the future database catalog. These tools do not import JSON and do not affect the active worker source. The worker still uses `data/playlists.json`.

Bulk playlist-channel operations:

```txt
POST /api/catalog/playlists/:id/channels/bulk-attach
POST /api/catalog/playlists/:id/channels/bulk-detach
```

Payload:

```json
{
  "channelIds": ["id1", "id2"]
}
```

Bulk channel-stream operations:

```txt
POST /api/catalog/channels/:id/streams/bulk-attach
POST /api/catalog/channels/:id/streams/bulk-detach
```

Payload:

```json
{
  "streamIds": ["id1", "id2"]
}
```

Bulk stream tools:

```txt
POST /api/catalog/streams/bulk-provider-assign
POST /api/catalog/streams/bulk-enable
POST /api/catalog/streams/bulk-disable
POST /api/catalog/streams/bulk-transform-preview
POST /api/catalog/streams/bulk-transform-apply
```

Provider assignment keeps existing `streamKey` values unchanged. Enable/disable only toggles `enabled`.

Transform preview payload:

```json
{
  "streamIds": ["id1", "id2"],
  "providerId": "provider-id",
  "prefixToStrip": "https://test.zhegal.com.ua/kstv/",
  "suffixToStrip": "/playlist.m3u8"
}
```

Preview does not save data. Apply updates only valid preview rows:

```txt
directUrl -> null
providerId -> selected Provider
streamKey -> computed value
```

Bulk operations return statistics such as `requested`, `created`, `updated`, `deleted`, `skipped`, and `failed`.

Important constraints:

- JSON Import Wizard is not implemented yet.
- Provider guessing is not implemented.
- Providers are not auto-created.
- URLs are transformed only with manually supplied prefix/suffix.
- The worker still uses `data/playlists.json`.

## JSON Import Wizard

The admin UI includes `/catalog/import`, a protected wizard for importing JSON playlist data into the PostgreSQL catalog. It does not switch the active worker source. The worker still uses `data/playlists.json`.

Wizard steps:

```txt
1. Source
2. Playlist
3. Preview
4. Apply result
```

Supported sources:

- pasted JSON;
- one of the URLs listed in `data/playlists.json`.

Supported JSON shapes reuse the current worker playlist normalizer:

```json
[
  { "title": "Channel", "url": "https://example.test/stream.m3u8" }
]
```

and:

```json
{
  "channels": [
    { "title": "Channel", "url": "https://example.test/stream.m3u8" }
  ]
}
```

Preview is mandatory and does not write to the database. It shows row counts, invalid rows, channels/streams/links to create, timezone presets to create/reuse, provider suggestions, direct URL streams, and skipped duplicates when duplicate skipping is enabled.

Apply creates catalog records only after confirmation:

- `Playlist`, when importing into a new playlist;
- `Channel`;
- `Stream`;
- `PlaylistChannel`;
- `ChannelStream`;
- `TimezonePreset`, using upsert by `timezone + label`;
- `ChannelTimezone`.

Provider suggestions use `Provider.matchPrefix` and `Provider.matchSuffix`. These fields are only import hints. Providers are not guessed globally, not created automatically, and not applied unless the preview selection is confirmed. When a Provider is selected for a row:

```txt
Stream.providerId = selected Provider
Stream.streamKey = computed value
Stream.directUrl = null
```

When no Provider is selected:

```txt
Stream.directUrl = original URL
Stream.providerId = null
Stream.streamKey = null
```

JSON Import Wizard does not implement DB worker mode, automatic provider creation, automatic common-prefix detection, or file/archive import.

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
