# Durable delivery

## Outbound (WordPress → Telegram)

1. A visitor message and its `telegram.deliver` outbox job are written in one transaction. Telegram is never called inside the visitor's request.
2. Processing paths:
   * **Immediate, bounded:** after the response is flushed (`fastcgi_finish_request` / `litespeed_finish_request`), the worker runs for at most 5 seconds; without those functions, a non-blocking HMAC-signed loopback request starts the worker.
   * **WP-Cron:** `televixo_worker` every minute (20-second budget). Traffic-dependent — see `cron.md`.
   * **WP-CLI:** `wp televixo worker --seconds=55` from host cron, or `--loop` under a supervisor.
3. Claiming: up to 2 jobs per batch, conditional `UPDATE` with a random 60-second lease; only the head job of each conversation (`ordering_key = conv:<id>`) is claimable, preserving order. Expired leases are reclaimed after crashes (verified by killing a worker with SIGKILL).
4. Multi-part messages (text chunks ≤ 3800 UTF‑16 units, then attachments) record each accepted part in `progress` and map its Telegram message ID before the next part is sent; retries resume at the first unsent part.

### Outcome classification (`Telegram/BotApi::classify`)

| Outcome | Examples | Action |
|---|---|---|
| ok | `ok:true` | map part, continue |
| retryable | connect/DNS failure, HTTP 429 (honours `retry_after`), 500/502/503 | exponential backoff with full jitter (5 s base, 1 h cap), 8 attempts, then `dead` |
| uncertain | cURL timeout after sending (28), empty reply/reset (52/56), HTTP 504, unparsable 200 | **held** as `uncertain` (default) — later messages still flow; admin reviews and retries or discards. Setting `uncertain_policy=retry` retries automatically (may duplicate). |
| auth | 401/404 (token revoked) | health flag `token`, retry every 30 min until fixed or exhausted |
| permanent | 400/403 (bot removed, chat not found, missing rights, message too long) | `dead` + health flag; visible in Delivery & health |
| special | `migrate_to_chat_id` | audited migration of destination + conversations, immediate retry |
| special (topics) | thread not found / closed | mark topic deleted → recreate (setting) and resend; closed → reopen and resend |

Exactly-once remote delivery is **not** claimed (Telegram has no idempotency key).

## Inbound (Telegram → WordPress)

1. Webhook authenticates the secret, bounds the body, stores the update (UNIQUE per bot + `update_id`) and only then returns 200. Storage failure → 500 → Telegram redelivers. Duplicates are acknowledged.
2. The worker processes stored updates in `update_id` order under a lease; failures retry up to 5 times.
3. A reply whose target mapping does not exist yet (arrived before our send was recorded) is **deferred** and retried (up to 3 attempts within ~2 minutes) instead of being rejected.

## Dead letters

Televixo → Delivery & health lists `dead` and `uncertain` jobs with redacted errors. *Retry* resets attempts; *Discard* cancels. `wp televixo queue list --status=dead` and `wp televixo queue retry <id>` do the same from the shell.

## Visitor polling

The widget polls `GET /conversations/{id}/updates?after=<cursor>`: 2.5 s while open and visible (8 s after a quiet minute), 15 s when closed with an active conversation, 30 s in a hidden tab, exponential backoff to 60 s on errors (with a "Reconnecting…" banner), and an immediate poll on `online`, focus and visibility. One tab is elected leader through a localStorage heartbeat and relays updates to other tabs over `BroadcastChannel`; a tab with the panel open always polls itself. Messages are merged by cursor, so relays and polls never duplicate. No long-running PHP requests are used.
