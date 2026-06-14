CREATE TABLE "providers" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "urlTemplate" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "providers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "streams" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "providerId" TEXT,
  "streamKey" TEXT,
  "directUrl" TEXT,
  "userAgent" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "streams_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "channels" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "defaultDelaySeconds" INTEGER,
  "defaultScale" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "channels_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "playlists" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "playlists_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "playlist_channels" (
  "id" TEXT NOT NULL,
  "playlistId" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "playlist_channels_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "channel_streams" (
  "id" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "streamId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "channel_streams_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "timezone_presets" (
  "id" TEXT NOT NULL,
  "timezone" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "timezone_presets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "channel_timezones" (
  "id" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "timezonePresetId" TEXT NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "channel_timezones_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "playlist_timezones" (
  "id" TEXT NOT NULL,
  "playlistId" TEXT NOT NULL,
  "timezonePresetId" TEXT NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "playlist_timezones_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "telegram_chats" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "chatId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "telegram_chats_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "caption_templates" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "template" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "caption_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "providers_enabled_idx" ON "providers"("enabled");
CREATE INDEX "providers_title_idx" ON "providers"("title");
CREATE INDEX "streams_providerId_idx" ON "streams"("providerId");
CREATE INDEX "streams_enabled_idx" ON "streams"("enabled");
CREATE INDEX "streams_title_idx" ON "streams"("title");
CREATE INDEX "channels_enabled_idx" ON "channels"("enabled");
CREATE INDEX "channels_title_idx" ON "channels"("title");
CREATE INDEX "playlists_enabled_idx" ON "playlists"("enabled");
CREATE INDEX "playlists_title_idx" ON "playlists"("title");
CREATE INDEX "playlist_channels_playlistId_idx" ON "playlist_channels"("playlistId");
CREATE INDEX "playlist_channels_channelId_idx" ON "playlist_channels"("channelId");
CREATE INDEX "playlist_channels_enabled_idx" ON "playlist_channels"("enabled");
CREATE INDEX "channel_streams_channelId_idx" ON "channel_streams"("channelId");
CREATE INDEX "channel_streams_streamId_idx" ON "channel_streams"("streamId");
CREATE INDEX "channel_streams_enabled_idx" ON "channel_streams"("enabled");
CREATE INDEX "timezone_presets_enabled_idx" ON "timezone_presets"("enabled");
CREATE INDEX "timezone_presets_timezone_idx" ON "timezone_presets"("timezone");
CREATE INDEX "timezone_presets_label_idx" ON "timezone_presets"("label");
CREATE INDEX "channel_timezones_channelId_idx" ON "channel_timezones"("channelId");
CREATE INDEX "channel_timezones_timezonePresetId_idx" ON "channel_timezones"("timezonePresetId");
CREATE INDEX "playlist_timezones_playlistId_idx" ON "playlist_timezones"("playlistId");
CREATE INDEX "playlist_timezones_timezonePresetId_idx" ON "playlist_timezones"("timezonePresetId");
CREATE INDEX "telegram_chats_enabled_idx" ON "telegram_chats"("enabled");
CREATE INDEX "telegram_chats_isDefault_idx" ON "telegram_chats"("isDefault");
CREATE INDEX "telegram_chats_title_idx" ON "telegram_chats"("title");
CREATE INDEX "caption_templates_enabled_idx" ON "caption_templates"("enabled");
CREATE INDEX "caption_templates_isDefault_idx" ON "caption_templates"("isDefault");
CREATE INDEX "caption_templates_title_idx" ON "caption_templates"("title");

ALTER TABLE "streams" ADD CONSTRAINT "streams_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "playlist_channels" ADD CONSTRAINT "playlist_channels_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "playlists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "playlist_channels" ADD CONSTRAINT "playlist_channels_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "channel_streams" ADD CONSTRAINT "channel_streams_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "channel_streams" ADD CONSTRAINT "channel_streams_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "streams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "channel_timezones" ADD CONSTRAINT "channel_timezones_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "channel_timezones" ADD CONSTRAINT "channel_timezones_timezonePresetId_fkey" FOREIGN KEY ("timezonePresetId") REFERENCES "timezone_presets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "playlist_timezones" ADD CONSTRAINT "playlist_timezones_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "playlists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "playlist_timezones" ADD CONSTRAINT "playlist_timezones_timezonePresetId_fkey" FOREIGN KEY ("timezonePresetId") REFERENCES "timezone_presets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
