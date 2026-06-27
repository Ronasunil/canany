-- Multi-tenancy: add accounts (users), tenants (orgs), the chat<->org link
-- (groups), one-time connect tokens, and a denormalized org_id on asks.
-- Fully additive: only ADDs a nullable column, new tables, indexes, and FKs —
-- the running single-tenant bot is unaffected (it writes org_id = NULL, never reads it).

-- AlterTable
ALTER TABLE "asks" ADD COLUMN "org_id" INTEGER;

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orgs" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "origin" TEXT NOT NULL DEFAULT 'web',
    "owner_user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orgs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "groups" (
    "id" SERIAL NOT NULL,
    "tg_chat_id" TEXT NOT NULL,
    "org_id" INTEGER NOT NULL,
    "title" TEXT,
    "connected_by" TEXT,
    "connected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connect_tokens" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "org_id" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "used_by_chat_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "connect_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "asks_org_id_status_idx" ON "asks"("org_id", "status");

-- CreateIndex
CREATE INDEX "asks_org_id_created_at_idx" ON "asks"("org_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "orgs_owner_user_id_idx" ON "orgs"("owner_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "groups_tg_chat_id_key" ON "groups"("tg_chat_id");

-- CreateIndex
CREATE INDEX "groups_org_id_idx" ON "groups"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "connect_tokens_token_key" ON "connect_tokens"("token");

-- CreateIndex
CREATE INDEX "connect_tokens_org_id_idx" ON "connect_tokens"("org_id");

-- AddForeignKey
ALTER TABLE "asks" ADD CONSTRAINT "asks_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orgs" ADD CONSTRAINT "orgs_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connect_tokens" ADD CONSTRAINT "connect_tokens_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
