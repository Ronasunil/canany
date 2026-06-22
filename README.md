# 🛠️ Can Anyone

An open asks board that lives **entirely inside Telegram**. Anyone posts "can someone do this?", anyone claims it, finishes it, and the outcome is kept. The "board" isn't a website — it's the **`/board`** command, answered with a monospace table right in the chat.

Built with custom code — **no Activepieces, no Baserow, no Docker**. Just a Node.js bot + PostgreSQL (via Prisma).

```
TELEGRAM (everything lives here)          NODE APP
 #ask · claim · done              ──▶    node-telegram-bot-api (long polling)
 /board /top /stalled commands             └─ reads/writes PostgreSQL
```

## What it does

- Post `#ask <your request>` in the chat → the bot saves it and replies with a card carrying the action buttons.
- **Urgency is set by the asker** (🔴 now · 🟡 EOD · 🟢 no-rush); **effort by the claimer** — tap a unit (~mins · ~hrs · ~days · ~weeks) and the bot asks "how many?", giving an exact effort like "3 hrs". Each is owned by the person who actually knows it — no auto-guessing.
- **✅ Done only works after ✋ Claim** — tapping it early shows "Claim it first". Closing prompts for an outcome.
- **`/board`** current asks (with outcomes) · **`/top`** month's builders · **`/stalled`** asks open > 2 days.

## Project layout

The code is organised in layers — config → domain → infrastructure → application → presentation — so each file has one clear job and `index.js` just wires them together.

```
src/
  config/index.js                  Loads + validates env once; the only place that reads process.env
  domain/constants.js              Shared vocabulary (status order, urgencies) — one source of truth
  infrastructure/
    db/prisma.js                   Prisma client (single shared instance)
    db/asksRepository.js           Prisma query helpers for the asks table
    telegram/client.js             Bot instance, command menu, polling
  application/
    handlers/message.js            New asks + force-reply capture (outcome / effort amount)
    handlers/callback.js           Claim · Done · urgency · effort button taps
    commands.js                    /board /top /stalled /help routing
    cards.js                       Re-render an ask card after a state change
    state.js                       In-memory map of outstanding force-reply prompts
  presentation/
    views.js                       Monospace table / card rendering
    keyboards.js                   Inline keyboard, reply helpers, display names, help copy
  index.js                         Composition root: validate → connect Prisma → wire → poll
prisma/schema.prisma               The `asks` model — source of truth; migrations build the DB
```

## Setup (local, no Docker)

1. **PostgreSQL** (native) — create the role and let it create its own database:
   ```bash
   sudo apt install postgresql
   sudo -u postgres psql -c "CREATE USER canany WITH PASSWORD 'canany';"
   sudo -u postgres psql -c "ALTER ROLE canany CREATEDB;"
   ```
   (No manual `CREATE DATABASE` — Prisma creates the `canany` database in step 4.)

2. **Telegram bot** (BotFather): create the bot, copy the token. Add it to your group **as admin** and run `/setprivacy → Disable` so it can see messages (a DM with the bot also works).

3. **Config + install**:
   ```bash
   cp .env.example .env      # fill in BOT_TOKEN + DATABASE_URL
   npm install               # also runs `prisma generate`
   ```

4. **Create the database + tables** (Prisma migrations — creates the `canany` DB and the `asks` table):
   ```bash
   npm run db:dev            # prisma migrate dev
   ```

5. **Run**:
   ```bash
   npm start
   ```

## Try it

In your group (or a DM with the bot):
```
#ask Can anyone make a quick landing page?
```
As the asker, tap an urgency button. Tap ✅ Done before claiming → "Claim it first". Tap ✋ Claim → tap an effort unit → reply with how many → ✅ Done → reply to the prompt with a link/outcome. Then run `/board`, `/top`, `/stalled`.

## Deploy — AWS 2× EC2 (no Docker)

**DB box (private):** `apt install postgresql`; create db + user; in `pg_hba.conf` allow the **app box's private VPC IP** only; security group opens **5432 from the app SG only** (no public IPv4).

**App box (public):** install Node; copy the project; `npm ci`; set `.env` with `DATABASE_URL=…@<db-private-ip>…`; apply migrations, then start:
```bash
npm run prisma:migrate    # prisma migrate deploy — builds tables in the existing DB
npm run pm2:start && pm2 save && pm2 startup
```
> In production `migrate deploy` does **not** create the database, so on the DB box create it once: `CREATE DATABASE canany OWNER canany;`
The app is **outbound-only** (long polling), so the security group only needs **SSH (22)** — no inbound web port.

> ⚠️ Only one instance may poll at a time. Stop the local bot before starting the one on EC2 (two pollers → Telegram `409 Conflict`).
