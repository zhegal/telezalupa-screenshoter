ALTER TABLE "providers" ADD COLUMN "matchPrefix" TEXT;
ALTER TABLE "providers" ADD COLUMN "matchSuffix" TEXT;

CREATE UNIQUE INDEX "timezone_presets_timezone_label_key" ON "timezone_presets"("timezone", "label");
