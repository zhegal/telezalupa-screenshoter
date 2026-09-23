# Content Quality And Telegram Engagement

This document records the agreed implementation sequence for screenshot filtering and Telegram
engagement. Each stage is implemented, documented, verified, and committed separately.

## Product Rules

- A screenshot is normalized to a deterministic `32x18` RGB thumbnail and hashed with SHA-256.
- A channel frame is skipped only when its thumbnail hash equals the last successfully published
  hash for that channel.
- Non-consecutive repetition is valid: `A -> B -> A` publishes all three frames.
- A skipped frame does not mark the stream as failed and does not change queue priority.
- Forbidden references use the same thumbnail normalization and exact hash comparison.
- A forbidden or consecutive duplicate frame moves processing to the next channel immediately.
- Only a successful Telegram publication updates the channel's last-published hash.
- All reaction types contribute to the pin threshold.
- The default pin threshold is `7`; configured values must be integers of at least `1`.
- A publication is never automatically unpinned after it has been pinned.
- Pin service messages are deleted for both automatic and manual pins.
- Comments retain available author identity snapshots, text, media presence, and a Telegram deep
  link. Sender-chat comments without a user ID remain readable but cannot be banned as users.
- A moderation ban retains the triggering comment, source publication, and an editable private note.

## Resource Constraints

- Keep one NestJS process and the existing PostgreSQL database.
- Use Telegram webhooks instead of a polling worker.
- Store hashes and metadata, not published screenshots or comment media.
- Store only a compact preview for a forbidden reference after upload normalization.
- Cache forbidden hashes in memory and invalidate the cache after reference changes.
- Do not add Redis, an external queue, object storage, OCR, or ML-based matching.

## Delivery Stages

### 1. Persistence foundation — complete

- Added channel frame state for database and legacy JSON channel keys.
- Added forbidden reference metadata and preview paths.
- Added Telegram publication, comment, and moderation ban records.
- Added explicit pin and ban lifecycle enums.
- Added the default `telegram.pinReactionThreshold=7` setting.
- Added uniqueness and lookup indexes required for idempotent webhook processing.

This stage intentionally does not change worker or Telegram runtime behavior.

### 2. Deterministic image fingerprints and worker filtering — complete

- Added `sharp` for one in-process image normalization pass.
- SHA-256 is generated from raw `32x18` RGB pixels.
- Database and JSON sources receive stable channel keys.
- Consecutive duplicate frames are filtered without changing queue priority.
- The frame hash is persisted only after Telegram confirms publication.
- Manual sends intentionally bypass duplicate filtering and become the new comparison baseline.
- Explicit worker outcomes and bounded immediate channel advancement prevent a busy loop.
- Focused tests cover `A -> A`, `A -> B -> A`, send failure, and bounded filtering.

### 3. Forbidden reference management — next

- Add authenticated CRUD and upload validation.
- Store compact previews under the managed data volume.
- Cache forbidden hashes in memory.
- Add the admin page for upload, rename, preview, and delete.
- Connect forbidden filtering to the worker.

### 4. Publication persistence and Telegram webhook

- Save successful publications with Telegram message IDs and frame hashes.
- Add a secret-token-protected webhook endpoint.
- Configure only the required Telegram update types.
- Map automatic discussion forwards to their source publications.

### 5. Reactions and pin lifecycle

- Add the editable reaction threshold setting.
- Sum all anonymous reaction counts.
- Atomically claim automatic pin operations.
- Track manual pins and ignore later reaction changes for pinned publications.
- Delete pin service messages.

### 6. Comment inbox and moderation

- Persist new and edited comments without downloading media.
- Add a simple newest-first comment view with Telegram links.
- Add permanent ban confirmation and an editable private note.
- Preserve the triggering comment and publication after Telegram removes messages.

### 7. Production rollout

- Back up PostgreSQL and the managed data volume.
- Apply migrations and deploy the tested build.
- Register the webhook at `https://telezalupa-api.zhegal.com.ua/api/telegram/webhook`.
- Verify filtering, reactions, manual and automatic pins, comments, and a test ban.
