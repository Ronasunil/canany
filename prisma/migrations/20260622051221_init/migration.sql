-- CreateTable
CREATE TABLE "asks" (
    "id" SERIAL NOT NULL,
    "ask" TEXT NOT NULL,
    "asker" TEXT NOT NULL,
    "effort" TEXT,
    "urgency" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "claimer" TEXT,
    "outcome" TEXT,
    "thread_link" TEXT,
    "tg_chat_id" TEXT,
    "tg_topic_id" TEXT,
    "tg_msg_id" TEXT,
    "tg_card_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimed_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "asks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "asks_status_idx" ON "asks"("status");

-- CreateIndex
CREATE INDEX "asks_created_at_idx" ON "asks"("created_at");
