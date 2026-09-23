INSERT INTO "system_settings" ("id", "key", "value", "createdAt", "updatedAt")
VALUES (
    'telegram-auto-pin-enabled',
    'telegram.autoPinEnabled',
    'false',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO NOTHING;
