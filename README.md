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
PORT=3000
```

Temporary playlist sources live in `data/playlists.json`. This file is intentionally simple and will later be replaced by PostgreSQL/admin configuration.

## Local Run

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run start:prod
```

Health check:

```bash
curl http://localhost:3000/health
```

## Docker

Local development compose publishes the app port to the host:

```bash
docker compose up -d --build
```

Production compose is intended for VPS usage behind Nginx Proxy Manager. It does not publish ports to the host; it exposes port `3000` only inside the external Docker network `proxy`.

```bash
docker compose -f docker-compose.production.yml up -d --build
```

Nginx Proxy Manager should be attached to the same external `proxy` network and can reach the backend by service/container name `screenshoter` on port `3000`.
