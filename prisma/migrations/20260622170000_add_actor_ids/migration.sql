-- Persist Telegram user ids so "asker-only" / "claimer-only" checks key off a
-- stable, unspoofable identity instead of the display-name string.
ALTER TABLE "asks" ADD COLUMN "asker_id" TEXT;
ALTER TABLE "asks" ADD COLUMN "claimer_id" TEXT;
