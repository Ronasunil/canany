# Multi-Tenancy Plan — Can Anyone

Turn Can Anyone into a multi-org product: **sign up**, **create an org in the
UI**, get a **bot to add to your group**, and that group gets its **own board**.
High-level plan, scoped to finish in **1.5 days**.

---

## Goal

- **Authenticate** (sign up / log in) to the web UI.
- Create an **org** from the UI.
- From the org, get a **bot you add to your Telegram group** (one tap).
- Once added, that group gets its **own board** (`/board`, `/top`, `/stalled`).
- Each org sees **only its own** data, in the bot and on the web.
- Existing groups are **migrated into their own orgs** (not a catch-all default).
- Done in 1.5 working days.

---

## The model

- **A tenant = an org.** An org is created in the UI and owns one or more groups.
- **A group is linked to an org** by running `/connect <token>` in the group.
- The board is read **per org**, both in the bot and on the web.

```
   sign up / log in (UI)
        │
        ▼
   create org  ─▶  get a one-time token  ─▶  add bot to group  ─▶  /connect <token>
        │                                                              │
        ▼                                                              ▼
   org account                                          bot verifies token →
   (per-org login)                                      group linked to the org
        │                                                              │
        └──────────────▶  one database, every board scoped to that org ◀───────
```

---

## User flow: org creation → connect a group

1. **Sign up / log in** to the web UI (real auth, not a shared password).
2. **Create an org** — just a name.
3. The org page shows a **one-time connect token** (and a link to add the bot).
4. **Add the bot to your group** (it stays unlinked until verified).
5. In the group, run **`/connect <token>`**.
6. The bot **verifies the token**, links that group to the org, and replies
   **"✅ Verified — connected to \<Org\>. Board is live."** The token is then
   **burned** (single-use). A wrong/expired token → **"❌ Invalid or expired."**
7. The org's **board is now live** — in the group via the bot, and on the web
   under that org's login.

> **Why a token:** the bot is public, so adding it to a group proves nothing. The
> one-time token (only visible to the logged-in org creator) is the proof the
> connect came from a real org. The bot must be able to see the command in groups
> (privacy mode disabled, or added as admin).

> **One important reality:** Telegram has **no way to create a brand-new bot
> automatically** — that only happens by hand in BotFather. So "get a bot" means
> **one shared bot with a per-org connect link**, not a freshly minted bot per
> org. Same experience (add the bot, get your board); isolation is by org. A true
> separate-bot-per-org (paste your own token) is a later option, not now.

---

## Key decisions (locked)

1. **Tenant = org**; a group links to an org via **`/connect <token>`**.
2. **Real authentication** — accounts (sign up / log in), each tied to its org.
3. **One shared bot + one-time connect token per org** (not a new bot per org).
4. **Direct messages are group-only.** Board commands in a DM with the bot are
   **disabled** — the bot replies "use it in your group" instead of a board.
5. **Web board is per-org** — each org logs in and sees only its data.

---

## Things we need to do

**Auth & UI**
1. Authentication flow — sign up, log in, log out, sessions.
2. Create-org screen that issues a **one-time connect token** + bot link.
3. Per-org board view (each org sees only its own).

**Backend / bot**
4. Add the org as the tenant; link groups to orgs; split every board view by org.
5. Make the bot read the org from the group a command comes from.
6. Add **`/connect <token>`** — verify the token, link the group to its org, burn
   the token.
7. Disable board commands in direct messages (redirect instead).

**Data**
8. Migrate existing groups into **their own orgs** (one org per existing group).

---

## Data migration (into orgs, not a default)

- Every ask already records the group it was raised in.
- For **each existing group**, create an org and link that group + its asks to it
  — so every legacy group becomes a real, isolated org from day one.
- No catch-all "default" bucket — each group lands in its own org.
- Additive and reversible — the live bot keeps working while we migrate.

---

## 1.5-day timeline

**Day 1 (full, ≈8h)**

| Time | Block | What gets done |
|------|-------|----------------|
| **Morning (≈4h)** | Backend + data | Add org as tenant · link groups→orgs · split every board view per org · migrate each existing group into its own org |
| **Afternoon (≈4h)** | Auth + UI | Authentication flow (sign up / log in / sessions) · create-org screen |

**Day 2 (half, ≈4h)**

| Time | Block | What gets done |
|------|-------|----------------|
| **Block 1 (≈2h)** | Connect + scope | `/connect <token>` (verify + link + burn token) · per-org board view · disable DM board commands |
| **Block 2 (≈1.5h)** | Test | Two-org check: Org A's data never shows for Org B · sign-up + `/connect` flow works · DM redirects · migration check |
| **Block 3 (≈0.5h)** | Ship | Run migration and deploy; smoke-test |

**Total: ~1.5 working days.**

> **Reality check:** 1.5 days fits if auth and the org UI stay lean (email/password
> login, a name field, a token + `/connect`). Social login, polished onboarding,
> custom branding, or a separate bot per org push past 1.5 days.

---

## Definition of Done

The full app is done when a new user can go through this entire flow end to end:

1. **Open the website** and **sign up / log in**.
2. **Create an org** (just a name).
3. Get a **one-time connect token** on the org page.
4. **Add the bot** to their Telegram group.
5. Run **`/connect <token>`** in the group → bot replies **"✅ Verified —
   connected."** (wrong/expired token → "❌ Invalid or expired").
6. The group's **board is live**: members post `#ask`, claim, and close asks, and
   `/board` / `/top` / `/stalled` show **only that org's** data.
7. A board command **in a DM** with the bot replies with the **redirect**, not a
   board.
8. Back on the **website**, the user sees **their org's board only** — no other
   org's data, in the bot or on the web.
9. Existing groups already appear as their **own migrated orgs**, data intact.

---

## Hosting & going to market (separate track)

**Today:** one EC2 app box runs *everything* together — the bot, the Express
server, and the web board rendered server-side with the EJS template engine
(frontend and backend in the same process). Postgres runs on a second box.

```
TODAY
  EC2 (app)  ──  bot + Express + EJS pages   ──▶  EC2 (Postgres)
                 (frontend & backend in one process)
```

**To take it to market, split frontend from backend:**

- **Frontend → React** (single-page app), replacing the EJS templates. Hosted as
  static files on a CDN (e.g. S3 + CloudFront, or Vercel/Netlify) — fast, scales
  on its own, deploys independently.
- **Backend → an API**, not an HTML renderer. Express stays but serves **JSON**;
  the **bot poller** lives here too (still one always-on process). Hosted on EC2
  (or containerized).
- **Database → managed Postgres** (e.g. RDS) for backups and failover, instead of
  self-managed on an instance.
- The React app talks to the backend over an **HTTPS API**, authenticated with
  the accounts/tokens from this plan.

```
TO MARKET
  React SPA (CDN)  ──HTTPS API──▶  Backend (API + bot poller, EC2)  ──▶  Managed Postgres
```

> This split is a **larger, separate effort** — rewriting the web board from EJS
> to React and re-hosting is **not** part of the 1.5-day multi-tenancy plan
> above. The multi-tenant backend (orgs, scoping, `/connect`) is built so either
> frontend — the current EJS board or a future React app — talks to the same
> per-org data.

**Done when (market split):**

- The **React app** is live on the CDN and serves the board; the EJS templates
  are retired.
- The backend serves a **JSON API only** (no HTML rendering).
- The React app authenticates against the backend and shows only the logged-in
  org's data.
- The **bot poller** runs as its own always-on process, unaffected by frontend
  deploys.
- The database runs on **managed Postgres** with backups enabled.
- Frontend and backend **deploy independently** of each other.

---


