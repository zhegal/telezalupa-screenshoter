# TV Screenshoter

TV Screenshoter is a private admin panel and background worker for a Telegram TV-monitoring channel.

The product workflow is simple:

1. The worker continuously picks an available TV channel.
2. It captures a frame from the stream with `ffmpeg`.
3. It posts the screenshot to one Telegram channel through one bot.
4. The admin watches the Telegram feed.
5. If a post has a wrong channel title, stream, timezone, or playlist grouping, the admin opens the panel and fixes the catalog quickly.

The core mental model is intentionally file-manager-like:

- `Playlist` is a folder.
- `Channel` is a file inside a playlist.
- `Stream` is channel metadata.
- Timezones, providers, Telegram settings, and caption templates are secondary dictionaries.

## Current State

Implemented:

- NestJS backend with TypeScript and ESM.
- Vue 3 admin frontend served by NestJS in production.
- PostgreSQL via Prisma.
- HttpOnly cookie authentication.
- Temporary bootstrap admin through `TEMP_ADMIN_PASSWORD`.
- In-process worker with start, stop, restart, and run-once controls.
- JSON source compatibility through `data/playlists.json`.
- Database source for the real catalog.
- Playlist/channel queue semantics for both sources.
- Stream fallback by priority when capture fails.
- Provider URL templates with `{streamKey}`.
- Direct URL streams.
- Channel timezone override with playlist timezone fallback.
- ffmpeg frame capture with watchdog/user-agent support.
- Telegram photo sending with HTML captions.
- Runtime dashboard, worker status, logs, playlist view, and channel search.
- Manual “send screenshot now” action for a playlist channel without changing the worker queue.
- JSON Import Wizard with preview/apply flow.
- Database foundation for frame deduplication, forbidden references, Telegram publications,
  reactions, comments, and moderation bans.
- Deterministic `32x18` RGB frame fingerprints and consecutive duplicate filtering for database and
  legacy JSON channel sources.
- Forbidden frame reference upload, exact-match filtering, compact previews, and admin management.
- Transactional persistence of successful Telegram publications and their frame baselines.
- Secret-token-protected Telegram webhook with idempotent update receipts and automatic discussion
  forward mapping.
- Opt-in reaction-based pinning, manual pin tracking, and pin service-message cleanup.
- Newest-first Telegram comment inbox with edit synchronization, deep links, permanent user bans,
  and editable private moderation notes.
- Docker local and production compose files.

Recently improved:

- Main admin navigation now follows the real workflow:
  - `Плейлисты`
  - `Поиск каналов`
  - `Импорт`
  - `Источники`
  - `Worker`
  - `Логи`
  - `Справочники`
- `/playlists` is now the primary daily screen.
- `/channels` is a quick search page for finding a channel from a Telegram post.
- `/catalog` is no longer the main workspace; it is a secondary dictionaries section.
- Large frontend API code was split into domain files.
- Some catalog page config/helpers were split out.
- Some backend catalog value/config helpers were split out.

Still needs work:

- Continue splitting large files into focused modules/components.
- Make playlist editing feel more like a file manager.
- Add faster inline channel editing for the “wrong Telegram post title” workflow.
- Simplify or hide secondary concepts that are not needed daily.
- Reduce old generic catalog/relation terminology in remaining internal screens.
- Improve Telegram-specific visibility: last posts, message IDs, failed sends, and quick jump from a posted channel to its catalog entry.
- Add tests for selector logic, availability logic, caption building, import preview, and database source loading.
- Roll out the content-quality and Telegram engagement stages to production.

## Requirements

- Node.js 20+
- npm
- ffmpeg installed locally for non-Docker capture
- Docker optional for local development
- PostgreSQL required

## Configuration

Copy `.env.example` to `.env`:

```env
TELEGRAM_BOT_TOKEN=
TELEGRAM_DEFAULT_CHAT_ID=
TELEGRAM_WEBHOOK_URL=
TELEGRAM_WEBHOOK_SECRET=
TEMP_ADMIN_PASSWORD=
PORT=3000

POSTGRES_DB=tv_screenshoter
POSTGRES_USER=tv_screenshoter
POSTGRES_PASSWORD=change_me
DATABASE_URL=postgresql://tv_screenshoter:change_me@localhost:5432/tv_screenshoter?schema=public
```

Important:

- `TELEGRAM_BOT_TOKEN` and `TELEGRAM_DEFAULT_CHAT_ID` are required for real posting. The default
  chat is the publication channel; there is no separate channel address setting.
- `TELEGRAM_WEBHOOK_URL` is the public HTTPS endpoint ending in `/api/telegram/webhook`.
- `TELEGRAM_WEBHOOK_SECRET` is a private value made from letters, digits, `_`, or `-` (up to 256
  characters). When both webhook values are present, the application verifies and configures the
  webhook during startup.
- `TEMP_ADMIN_PASSWORD` is required only until the first real admin user is created.
- `data/playlists.json` is still supported as the legacy JSON source.
- Secrets must stay in `.env`, not in source files.

First login before users exist:

- login: `admin`
- password: value of `TEMP_ADMIN_PASSWORD`

After login, open `/setup` and create the first real admin. Once a real user exists, the temporary `admin` login is disabled.

## Local Development

Install dependencies:

```bash
npm install
```

Run backend:

```bash
npm run dev:backend
```

Run frontend dev server:

```bash
npm run dev:frontend
```

The Vite dev server proxies `/api` to `http://127.0.0.1:3000`.

For non-Docker development, `DATABASE_URL` must point to a reachable PostgreSQL database.

Useful commands:

```bash
npm run build
npm run lint
npm run format
npm run prisma:generate
npm run prisma:migrate
npm run prisma:deploy
npm run prisma:studio
```

Production run without Docker:

```bash
npm run build
npm run start:prod
```

`start:prod` runs `prisma migrate deploy` before starting NestJS.

Health check:

```bash
curl http://localhost:3000/api/health
```

## Docker

Local compose:

```bash
docker compose up -d --build
```

Local compose starts:

- `screenshoter`
- `postgres`

It publishes app port `3000` only on `127.0.0.1` for local development; the port is not exposed on public host interfaces. PostgreSQL is internal to Docker and uses the `postgres_data` volume. Managed JSON source files and backups use the `screenshoter_data` volume mounted at `/app/data`.

Production compose:

```bash
docker compose -f docker-compose.production.yml up -d --build
```

Production is intended for VPS usage behind Nginx Proxy Manager:

- backend port is not published with `ports`;
- backend uses `expose: "3000"`;
- `screenshoter` is attached to external Docker network `proxy`;
- PostgreSQL is attached only to an internal network;
- Nginx Proxy Manager should reach the app as `screenshoter:3000` inside the `proxy` network.

## Source Modes

The active channel source is stored in PostgreSQL `system_settings`.

### JSON Source

Legacy-compatible mode.

The worker reads playlist URLs from:

```txt
data/playlists.json
```

Then it loads remote JSON playlists, normalizes channels, and uses the legacy in-memory queue logic.

Use JSON source when:

- migrating from the original project;
- testing quickly without filling PostgreSQL catalog;
- keeping a fallback source available.

In JSON mode:

- `/playlists` is read-only runtime state;
- `/channels` is read-only runtime search;
- catalog edits do not affect the worker.

### Database Source

Current primary mode.

The worker reads enabled records from PostgreSQL:

```txt
Playlist
 -> PlaylistChannel
     -> Channel
         -> ChannelStream
             -> Stream
                 -> Provider
```

Rules:

- only enabled records are used;
- playlists remain balancing groups;
- channels are queued inside playlists;
- streams are tried by priority;
- provider streams build URL from `Provider.urlTemplate` and `Stream.streamKey`;
- direct streams use `Stream.directUrl`;
- channel timezones override playlist timezones;
- playlist timezones are fallback;
- project defaults are used when neither channel nor playlist timezones exist.

In Database mode:

- `/playlists` is the main management screen;
- `/channels` searches real database channels;
- worker screenshots are created from PostgreSQL catalog data.

## Admin Workflow

### Daily Flow

1. Watch the Telegram monitoring channel.
2. Notice a bad title, wrong grouping, bad stream, or timezone issue.
3. Open admin.
4. Use `/channels` to search by visible Telegram channel title, or open `/playlists`.
5. Edit the channel or playlist.
6. Optionally send a screenshot for that channel immediately from the playlist channel list.
7. Worker continues running in the same Node process and its queue is not changed by the manual send.

### Playlist Management

Open:

```txt
/playlists
```

Database source behavior:

- shows real database playlists;
- creates a new playlist;
- opens playlist edit page;
- deletes playlist with owned channels and streams.
- sends a channel screenshot immediately from the playlist channel list without changing worker queue state.

Playlist edit route:

```txt
/catalog/playlists/:id
```

Tabs:

- `Основное`
- `Каналы`
- `Таймзоны`

A playlist owns its channels. Deleting a playlist deletes its owned channels and streams.

### Channel Management

Open:

```txt
/channels
```

This page is intended for quickly finding a channel from a Telegram post.

Channel edit route:

```txt
/catalog/channels/:id
```

Tabs:

- `Основное`
- `Потоки`
- `Таймзоны`

A channel owns its streams. Deleting a channel deletes its streams.

### Streams

Streams are not treated as a primary top-level user concept in the UI.

They are channel metadata:

- Direct URL stream;
- Provider + Stream Key stream;
- optional User-Agent;
- priority;
- enabled status.

### Providers

Providers live in:

```txt
/catalog
```

Provider has:

- title;
- `urlTemplate`;
- enabled flag.

`urlTemplate` must contain:

```txt
{streamKey}
```

Example:

```txt
https://example.test/live/{streamKey}/playlist.m3u8
```

Import provider matching also uses `urlTemplate`: the part before `{streamKey}` acts as prefix, and the part after it acts as suffix.

### Timezones

Timezone presets live in `/catalog`.

Channel timezones have priority over playlist timezones. Playlist timezones are fallback for channels without explicit timezones.

### Telegram

Current production assumption:

- one bot;
- one destination selected by `TELEGRAM_DEFAULT_CHAT_ID`; that destination is the publication
  channel;
- screenshots are posted there continuously.

No second channel address or username is configured. Telegram supplies the linked discussion group
identity through automatic-forward updates.

The database contains persistence for:

- the last successfully published frame hash per channel;
- forbidden frame references;
- Telegram publications and their pin state;
- comments linked to publications;
- moderation bans with an editable private note.

The worker currently computes a SHA-256 fingerprint from deterministic `32x18` RGB pixels. It skips
a frame when its fingerprint equals the last successfully published frame for that channel. The
stored fingerprint changes only after Telegram accepts the publication, so `A -> A` is filtered
while `A -> B -> A` remains valid. Filtered channels are advanced immediately with a bounded cycle
to prevent a busy loop when every available channel is unchanged.

Manual “send screenshot now” remains an explicit override: it sends the requested frame and then
stores that frame as the channel's new comparison baseline. It does not override forbidden frame
filtering.

Forbidden references are managed at `/frame-references`. JPEG, PNG, and WebP uploads up to 10 MB
are normalized with the same fingerprint pipeline used by the worker. Only a compact WebP preview
and the hash are retained; original uploads and published screenshots are not duplicated on disk.
Preview files default to `data/forbidden-frame-references`, which is already inside the managed
Docker data volume. `FORBIDDEN_REFERENCES_DIR` can override this location.

Reaction-based pinning is configured at `/telegram`. It is disabled by default and must be enabled
manually in the admin panel. Its threshold is stored under `telegram.pinReactionThreshold`, starts
at `7`, and accepts integers of `1` or greater. The webhook processor sums every reaction type
reported by Telegram. Once a publication is pinned, later reaction changes never cause automatic
unpinning or another automatic pin attempt.

Manual and automatic pins are recorded with their source. Telegram pin service messages are
deleted immediately when their webhook update arrives.

Discussion comments are available at `/telegram/comments`, newest first. New and edited messages
retain the author's ID, username and display name snapshot, text, media-presence flag, and a direct
Telegram link; media files themselves are never downloaded. Replies to an existing comment inherit
its source publication. Messages sent as a chat remain readable but cannot be banned without a user
ID.

Blocking an author requires confirmation and uses a permanent discussion-group ban. The database
keeps the triggering comment and publication even when Telegram removes messages. A private note
of up to 2000 characters can be saved with the ban and edited later.

Frame filtering, publication persistence, and inbound Telegram webhook handling are active.
Successful sends store the Telegram chat/message IDs and the frame baseline in one database
transaction. Incoming updates are deduplicated by `update_id`; receipt records older than seven
days are periodically removed. Automatic discussion forwards populate the discussion chat and root
message IDs for the source publication. Webhook state is visible at `/telegram`. Progress is tracked in
[`docs/content-quality-roadmap.md`](docs/content-quality-roadmap.md).

## JSON Import Wizard

Open:

```txt
/catalog/import
```

Supported input:

- pasted JSON;
- URL from `data/playlists.json`.

Supported shapes:

```json
[
  { "title": "Channel", "url": "https://example.test/stream.m3u8" }
]
```

```json
{
  "channels": [
    { "title": "Channel", "url": "https://example.test/stream.m3u8" }
  ]
}
```

Flow:

1. Choose source.
2. Choose target playlist or create a new one.
3. Preview normalized rows.
4. Apply result.

Preview shows:

- rows count;
- invalid rows;
- channels to create;
- streams to create;
- playlist links;
- timezone presets to create/reuse;
- provider suggestions;
- direct URL streams;
- skipped duplicates.

Apply creates:

- Playlist when importing into a new playlist;
- Channel;
- Stream;
- PlaylistChannel;
- ChannelStream;
- TimezonePreset;
- ChannelTimezone.

Import does not switch the active worker source automatically.

## Runtime And API

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

Source management:

```txt
GET    /api/settings/sources/status
PATCH  /api/settings/sources/active
GET    /api/settings/sources/json-file
PUT    /api/settings/sources/json-file
DELETE /api/settings/sources/json-file
```

Telegram management:

```txt
GET   /api/telegram/webhook/status
GET   /api/telegram/settings
PATCH /api/telegram/settings
GET   /api/telegram/comments
POST  /api/telegram/comments/:id/ban
PATCH /api/telegram/bans/:id
```

Catalog CRUD:

```txt
GET    /api/catalog/:entity
GET    /api/catalog/:entity/:id
POST   /api/catalog/:entity
PATCH  /api/catalog/:entity/:id
DELETE /api/catalog/:entity/:id
```

Supported catalog entities:

```txt
providers
streams
channels
playlists
timezones
telegram-chats
caption-templates
```

Forbidden frame references:

```txt
GET    /api/frame-references
POST   /api/frame-references
PATCH  /api/frame-references/:id
DELETE /api/frame-references/:id
GET    /api/frame-references/:id/preview
```

Creation uses `multipart/form-data` fields `label` and `file`.

Owned playlist/channel operations:

```txt
POST   /api/catalog/playlists/:id/channels/owned
DELETE /api/catalog/playlists/:id/channels/:channelId/owned
POST   /api/catalog/playlists/:id/channels/bulk-delete-owned
POST   /api/catalog/playlists/:id/channels/:channelId/copy
POST   /api/catalog/playlists/:id/channels/:channelId/move
POST   /api/catalog/playlists/:id/channels/:channelId/send-now
POST   /api/catalog/channels/:id/streams/owned
DELETE /api/catalog/channels/:id/streams/:streamId/owned
```

Import:

```txt
GET  /api/catalog/import/sources
POST /api/catalog/import/preview
POST /api/catalog/import/apply
```

## Project Structure

Backend:

```txt
src/
  auth/
  capture/
  captions/
  catalog/
  channels/
  config/
  frames/
  logs/
  playlists/
  runtime/
  settings/
  system/
  telegram/
  worker/
```

Frontend:

```txt
frontend/src/
  components/
  layouts/
  pages/
  router/
  services/
  stores/
  styles/
```

Prisma:

```txt
prisma/
  schema.prisma
  migrations/
```

## Code Health

Current codebase is functional, but still needs decomposition.

Largest files at the moment:

- `src/catalog/catalog.service.ts`
- `frontend/src/pages/catalog/CatalogPage.vue`
- `src/playlists/database-playlist-selector.service.ts`
- `frontend/src/pages/catalog/PlaylistEditPage.vue`
- `frontend/src/pages/catalog/ChannelEditPage.vue`
- `src/catalog/catalog-import.service.ts`
- `frontend/src/pages/catalog/CatalogImportPage.vue`
- `src/worker/worker.service.ts`
- `frontend/src/pages/catalog/CatalogRelationManagePage.vue`
- `frontend/src/pages/SettingsSourcesPage.vue`

Target:

- backend service/module files around 100-150 lines where practical;
- Vue page components around 100-150 lines;
- large screens split into page container + tab components + form components + composables;
- backend catalog logic split into CRUD, owned playlist channels, owned streams, timezones, import, and bulk operation services.

Recommended next refactor order:

1. Split `PlaylistEditPage.vue` into:
   - `PlaylistBasicTab.vue`
   - `PlaylistChannelsTab.vue`
   - `PlaylistTimezonesTab.vue`
   - channel create/move/copy modals
2. Split `ChannelEditPage.vue` into:
   - `ChannelBasicTab.vue`
   - `ChannelStreamsTab.vue`
   - `ChannelTimezonesTab.vue`
   - stream create modal
3. Split `catalog.service.ts` into smaller Nest services:
   - `CatalogCrudService`
   - `CatalogPlaylistChannelsService`
   - `CatalogChannelStreamsService`
   - `CatalogTimezonesService`
   - `CatalogBulkService`
4. Split `database-playlist-selector.service.ts` into:
   - database loader/query builder;
   - database normalizer;
   - queue selector;
   - stream fallback state.
5. Split `CatalogImportPage.vue` into wizard step components.
6. Split `catalog-import.service.ts` into source loading, preview building, provider matching, and apply service.

## Tests

Focused automated coverage now includes frame fingerprints and filtering, forbidden references,
Telegram webhook idempotency, reaction pinning, comment-to-publication mapping, comment edits and
nested replies, and moderation audit preservation.

Remaining high-value tests:

- playlist normalizer;
- channel availability;
- channel timezone fallback;
- database playlist selector;
- stream fallback;
- caption builder;
- provider URL template matching;
- JSON Import Wizard preview/apply;
- source switching.

## Known Product Decisions

- Database source is now the primary direction.
- JSON source stays as compatibility and fallback.
- One configured Telegram bot and `TELEGRAM_DEFAULT_CHAT_ID` are enough for publishing. The linked
  discussion group is discovered from Telegram updates.
- Multi-chat publishing and worker groups are out of scope.
- Consecutive duplicate and forbidden-reference filtering must not change the channel queue or its
  existing priority behavior.
- Reaction-triggered pinning, manual pin tracking, comments, and moderation are active.
- Streams should stay visually subordinate to channels.
- Timezones and providers are important but secondary to playlist/channel maintenance.

## Deployment Notes

For VPS deployment behind Nginx Proxy Manager:

- use `docker-compose.production.yml`;
- ensure external Docker network `proxy` exists;
- attach Nginx Proxy Manager to the same `proxy` network;
- configure proxy host to `screenshoter:3000`;
- do not publish backend or PostgreSQL ports directly to the host.

Production data:

- PostgreSQL data: `postgres_data`;
- managed JSON source/backups: `screenshoter_data`.

The latest rollout deployed commit `f48e0c8` with all Prisma migrations applied. Pre-deployment
database, data-volume, and environment backups are stored under the ignored `backups/` directory
on the server and verified with SHA-256 checksums. The health endpoint, protected API behavior,
Telegram webhook registration, publication persistence, and discussion-forward mapping were
verified after deployment. Interactive acceptance checks for reactions, pins, comments, and a test
ban remain intentionally manual.
