CREATE TABLE "telegram_update_receipts" (
    "updateId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_update_receipts_pkey" PRIMARY KEY ("updateId")
);

CREATE INDEX "telegram_update_receipts_createdAt_idx" ON "telegram_update_receipts"("createdAt");
