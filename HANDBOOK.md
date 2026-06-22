# 🛠️ Can Anyone — Handbook

**Can Anyone** lives inside your Telegram group. Someone posts "can anyone do this?",
someone else grabs it, finishes it, and the bot keeps a tidy record — all in the chat.
No website, no app to install. This handbook covers how to use it and what it can (and
can't) do.

---

## The whole thing in one line

```
#ask ...   →   set urgency   →   ✋ Claim   →   pick effort + how many   →   ✅ Done (+ outcome)
 (open)         (you, asker)     (anyone)         (whoever claimed)          (closed & saved)
```

---

## Step by step

### 1. Add the bot to your group and make it an admin  *(one-time, by the group owner)*
1. Add this bot — **[t.me/cananytghBot](https://t.me/cananytghBot)** — to your Telegram group.
2. Make it an **admin**: open the group → **Manage group** → **Administrators** →
   **Add admin** → choose the bot.

This is required — **only an admin bot can read the group's messages**, so without this
step the bot can't see your `#ask` at all. Basic admin rights are enough.
(You don't create a bot — just add this existing one.)

### 2. Post an ask
Type a message that starts with **`#ask`**:

```
#ask Can anyone come to the office tomorrow?
```

The bot replies with a **card** for that ask, with buttons under it.

### 3. Set the urgency  *(you, the one who asked)*
On your card, tap one:
- 🔴 **now** — needed right away
- 🟡 **EOD** — by end of day
- 🟢 **no-rush** — whenever

Only the person who posted the ask can set its urgency.

### 4. Claim it  *(anyone who can help)*
Tap **✋ Claim** to take it. The card now shows **claimed** with your name, and the
Claim button goes away so no one grabs it twice.

### 5. Say the effort  *(whoever claimed it)*
After claiming, tap the unit that fits: **~mins · ~hrs · ~days · ~weeks**.
The bot then asks **"how many?"** — **reply to that message with a number** (e.g. `3`).
Your effort shows as **`3 hrs`**. Tapped the wrong unit? Just tap another one to redo it.

Only the person who claimed it can set the effort.

### 6. Finish it  *(whoever claimed it)*
1. Tap **✅ Done**. (Tapping it before claiming just says "Claim it first".)
2. The bot asks for the **outcome** — **reply to that message** with a link or a short
   note of what got done.
3. The ask is now **closed**, with the outcome saved.

---

## Commands (type these in the chat)

| Command | What you get |
|---|---|
| `/board` | All current asks at a glance — who asked, urgency, effort, status, who's on it, outcomes. |
| `/top` | This month's top builders (who shipped, helped, and raised the most). |
| `/stalled` | Asks that have sat open too long and need attention. |
| `/help` | A quick reminder of how the bot works. |

---

## Good to know

- **Reply to the bot's question** — when it asks "how many?" or asks for the outcome,
  use Telegram's **Reply** on that exact message (not a brand-new message). That's how
  the bot knows your answer belongs to that ask.
- **Each role owns its part:** the asker sets urgency; the claimer sets effort and the
  outcome. You can't change someone else's — the bot keeps it straight.
- **The order is fixed:** open → claimed → done. Claim before you finish.

---

## If something doesn't work

| What you see | What to do |
|---|---|
| The bot ignores your `#ask` | The bot isn't an admin yet — see **Step 1**. Only an admin bot can read the group's messages. |
| Your reply didn't register | Use **Reply** on the bot's question, not a separate new message. |
| "Only the asker / claimer can…" | That action belongs to whoever raised or claimed the ask. |
| The bot is completely silent | It may be down for maintenance — let whoever runs it know. |

---

## ⚠️ Limitations & how it's run

Please read this — it sets expectations for what the bot is for.

- **One group only (single-tenant).** Can Anyone was built for a single team during
  **Hack Hour**, so it serves **one Telegram group**. There is **no cross-group /
  multi-workspace support** — it isn't designed to run shared across many groups.
- **Not built for sensitive data.** It has **no data-protection features** — no
  encryption at rest, access controls, audit trail. Treat the board as
  shared scratch space for your group; **don't put passwords, personal, or confidential
  info** in asks or outcomes.
- **Lean, cost-optimised hosting.** It runs on a **single AWS EC2 free-tier instance**,
  with **PostgreSQL on the same box**, to keep running costs near zero. That means
  limited capacity and **no redundancy / high-availability** — if that one instance
  restarts or goes down, the bot is briefly unavailable until it's back.

In short: a lightweight, single-team helper — great for an internal "who can grab this?"
board, not a hardened multi-tenant product.

---

Post an `#ask` and give it a go. 🚀
