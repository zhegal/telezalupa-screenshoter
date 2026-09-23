CREATE TYPE "TelegramPinStatus" AS ENUM ('none', 'pending', 'pinned', 'error');
CREATE TYPE "TelegramPinSource" AS ENUM ('automatic', 'manual');
CREATE TYPE "TelegramBanStatus" AS ENUM ('pending', 'completed', 'error');

CREATE TABLE "channel_frame_states" (
    "id" TEXT NOT NULL,
    "channelKey" TEXT NOT NULL,
    "channelId" TEXT,
    "lastPublishedHash" TEXT NOT NULL,
    "lastPublishedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_frame_states_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "forbidden_frame_references" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "thumbnailHash" TEXT NOT NULL,
    "previewPath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "forbidden_frame_references_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "telegram_publications" (
    "id" TEXT NOT NULL,
    "channelKey" TEXT NOT NULL,
    "channelId" TEXT,
    "chatId" TEXT NOT NULL,
    "messageId" INTEGER NOT NULL,
    "frameHash" TEXT NOT NULL,
    "channelTitle" TEXT NOT NULL,
    "reactionCount" INTEGER NOT NULL DEFAULT 0,
    "pinStatus" "TelegramPinStatus" NOT NULL DEFAULT 'none',
    "pinSource" "TelegramPinSource",
    "pinError" TEXT,
    "pinnedAt" TIMESTAMP(3),
    "discussionChatId" TEXT,
    "discussionRootMessageId" INTEGER,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_publications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "telegram_comments" (
    "id" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "discussionChatId" TEXT NOT NULL,
    "messageId" INTEGER NOT NULL,
    "telegramUserId" TEXT,
    "authorUsername" TEXT,
    "authorDisplayName" TEXT NOT NULL,
    "text" TEXT,
    "hasMedia" BOOLEAN NOT NULL DEFAULT false,
    "telegramUrl" TEXT NOT NULL,
    "messageCreatedAt" TIMESTAMP(3) NOT NULL,
    "messageEditedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_comments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "telegram_user_bans" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "discussionChatId" TEXT NOT NULL,
    "telegramUserId" TEXT NOT NULL,
    "authorUsername" TEXT,
    "authorDisplayName" TEXT NOT NULL,
    "note" TEXT,
    "status" "TelegramBanStatus" NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "bannedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_user_bans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "channel_frame_states_channelKey_key" ON "channel_frame_states"("channelKey");
CREATE UNIQUE INDEX "channel_frame_states_channelId_key" ON "channel_frame_states"("channelId");
CREATE INDEX "channel_frame_states_lastPublishedAt_idx" ON "channel_frame_states"("lastPublishedAt");

CREATE UNIQUE INDEX "forbidden_frame_references_thumbnailHash_key" ON "forbidden_frame_references"("thumbnailHash");
CREATE INDEX "forbidden_frame_references_label_idx" ON "forbidden_frame_references"("label");

CREATE UNIQUE INDEX "telegram_publications_chatId_messageId_key" ON "telegram_publications"("chatId", "messageId");
CREATE UNIQUE INDEX "telegram_publications_discussionChatId_discussionRootMessageId_key" ON "telegram_publications"("discussionChatId", "discussionRootMessageId");
CREATE INDEX "telegram_publications_channelKey_idx" ON "telegram_publications"("channelKey");
CREATE INDEX "telegram_publications_channelId_idx" ON "telegram_publications"("channelId");
CREATE INDEX "telegram_publications_pinStatus_idx" ON "telegram_publications"("pinStatus");
CREATE INDEX "telegram_publications_publishedAt_idx" ON "telegram_publications"("publishedAt");

CREATE UNIQUE INDEX "telegram_comments_discussionChatId_messageId_key" ON "telegram_comments"("discussionChatId", "messageId");
CREATE INDEX "telegram_comments_publicationId_idx" ON "telegram_comments"("publicationId");
CREATE INDEX "telegram_comments_telegramUserId_idx" ON "telegram_comments"("telegramUserId");
CREATE INDEX "telegram_comments_messageCreatedAt_idx" ON "telegram_comments"("messageCreatedAt");

CREATE UNIQUE INDEX "telegram_user_bans_commentId_key" ON "telegram_user_bans"("commentId");
CREATE INDEX "telegram_user_bans_publicationId_idx" ON "telegram_user_bans"("publicationId");
CREATE INDEX "telegram_user_bans_telegramUserId_idx" ON "telegram_user_bans"("telegramUserId");
CREATE INDEX "telegram_user_bans_status_idx" ON "telegram_user_bans"("status");
CREATE INDEX "telegram_user_bans_createdAt_idx" ON "telegram_user_bans"("createdAt");

ALTER TABLE "channel_frame_states"
ADD CONSTRAINT "channel_frame_states_channelId_fkey"
FOREIGN KEY ("channelId") REFERENCES "channels"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "telegram_publications"
ADD CONSTRAINT "telegram_publications_channelId_fkey"
FOREIGN KEY ("channelId") REFERENCES "channels"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "telegram_comments"
ADD CONSTRAINT "telegram_comments_publicationId_fkey"
FOREIGN KEY ("publicationId") REFERENCES "telegram_publications"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "telegram_user_bans"
ADD CONSTRAINT "telegram_user_bans_commentId_fkey"
FOREIGN KEY ("commentId") REFERENCES "telegram_comments"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "telegram_user_bans"
ADD CONSTRAINT "telegram_user_bans_publicationId_fkey"
FOREIGN KEY ("publicationId") REFERENCES "telegram_publications"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "system_settings" ("id", "key", "value", "createdAt", "updatedAt")
VALUES (
    'telegram-pin-reaction-threshold',
    'telegram.pinReactionThreshold',
    '7',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO NOTHING;
