-- Attachments for #ask: files (photos/documents/…) sent with an ask. Bytes live
-- in S3; this table holds the object key + Telegram/media metadata. Fully additive
-- (one new table + index + FK) — existing asks are untouched.

-- CreateTable
CREATE TABLE "ask_attachments" (
    "id" SERIAL NOT NULL,
    "ask_id" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "s3_key" TEXT,
    "tg_file_id" TEXT,
    "tg_file_unique_id" TEXT,
    "file_name" TEXT,
    "mime_type" TEXT,
    "file_size" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ask_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ask_attachments_ask_id_idx" ON "ask_attachments"("ask_id");

-- AddForeignKey
ALTER TABLE "ask_attachments" ADD CONSTRAINT "ask_attachments_ask_id_fkey" FOREIGN KEY ("ask_id") REFERENCES "asks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
