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
- Reaction-based automatic pinning is disabled by default and can only be enabled explicitly from
  the admin panel.
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

### 3. Forbidden reference management — complete

- Added authenticated CRUD with label, MIME, and 10 MB upload validation.
- Compact WebP previews are stored under the managed data volume; originals are discarded.
- Forbidden hashes are loaded into an in-memory set and updated after CRUD operations.
- Added the admin page for upload, rename, preview, and delete.
- Worker and manual screenshots are filtered before Telegram delivery.
- Tests cover lifecycle, duplicate upload rejection, cache invalidation, and worker filtering.

### 4. Publication persistence and Telegram webhook — complete

- Successful sends now persist Telegram chat/message IDs and frame hashes together with the channel
  frame baseline in one database transaction.
- The destination in `TELEGRAM_DEFAULT_CHAT_ID` is the publication channel; no separate channel
  address or username setting is used.
- Added a secret-token-protected webhook endpoint and authenticated status view at `/telegram`.
- Startup setup configures only message, edited message, channel post, edited channel post, and
  aggregate reaction-count updates when webhook environment values are present.
- Persistent `update_id` receipts make webhook delivery idempotent and are retained for seven days.
- Automatic discussion forwards are mapped to their source publications without a separately
  configured discussion chat ID.

### 5. Reactions and pin lifecycle — complete

- Added `/telegram` controls for the opt-in `telegram.autoPinEnabled` setting and an editable
  reaction threshold of at least `1`.
- Automatic pinning defaults to disabled; the initial threshold remains `7` until an administrator
  changes it.
- Aggregate updates sum all reaction types and store their absolute current count.
- Eligible publications are atomically claimed before calling `pinChatMessage`, preventing
  concurrent webhook updates from triggering duplicate pin calls.
- Successful, failed, automatic, and manual pin states are retained. Pinned publications ignore
  all later reaction changes and are never automatically unpinned.
- Pin service messages are deleted for both automatic and manual pins.
- Focused tests cover disabled-by-default behavior, summed thresholds, single pin execution,
  post-pin reaction changes, manual pin tracking, and settings validation.

### 6. Comment inbox and moderation — complete

- New and edited discussion messages are persisted without downloading media files.
- Direct comments map through the discussion root; nested replies inherit the publication from an
  already stored parent comment.
- Author ID, username and display-name snapshots, text, media presence, timestamps, and direct
  Telegram links are retained.
- Added `/telegram/comments`, a simple newest-first paginated inbox with open-comment and ban-user
  actions.
- Permanent bans require confirmation, preserve the triggering comment and source publication, and
  support editable private notes of up to 2000 characters.
- Sender-chat comments without a user ID remain visible while their ban action is disabled.
- Focused tests cover new comments, edits, nested replies, media metadata, deep links, successful
  bans, private notes, and sender-chat restrictions.

### 7. Production rollout — next

- Back up PostgreSQL and the managed data volume.
- Apply migrations and deploy the tested build.
- Register the webhook URL configured through `TELEGRAM_WEBHOOK_URL`.
- Verify filtering, reactions, manual and automatic pins, comments, and a test ban.
