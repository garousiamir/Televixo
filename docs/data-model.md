# Data model

All tables use `{$wpdb->prefix}televixo_`, InnoDB and `utf8mb4`. Every `DATETIME` is **UTC**; the admin and widget localize for display. Provider identifiers (Telegram chat, user, message, thread, update IDs) are `VARCHAR(32)` strings so 64-bit values never lose precision (JSON is decoded with `JSON_BIGINT_AS_STRING`). Public identifiers are random 26-character base32 strings (130 bits); internal numeric IDs are never shown to visitors except the monotonically increasing message cursor.

Schema source: `televixo/includes/Persistence/Schema.php`. Migrations: `Persistence/Migrator.php` (option `televixo_db_version`, current version `1`; idempotent `dbDelta` re-applied after each step, five-minute lock against concurrent upgrades).

## Tables

| Table | Purpose | Key fields & indexes | Deleted by |
|---|---|---|---|
| `visitors` | Website visitor profile | `public_id` UNIQUE; `wp_user_id`, `email`, `last_seen_at`, `network_hash` (HMAC of IP, never raw IP); `is_blocked` | retention when no conversations remain and last seen > retention; privacy eraser |
| `sessions` | Revocable visitor sessions | `token_hash` UNIQUE (HMAC-SHA256 of the 256-bit token; plaintext never stored); `expires_at`; `revoked_at`; `wp_user_id` binding | purge 7 days after expiry/revocation; visitor deletion |
| `conversations` | Conversation state | `public_id`, `reference` UNIQUE; `status`; `routing_snapshot` (immutable JSON); `provider_account/chat_id/thread_id`; read markers; typing deadlines; keys `(visitor_id,status)`, `(status,last_message_at)`, `(assigned_operator_id,status)`, `(team_id,status)`, `(last_message_at,id)`, `provider_chat_id` | retention (closed/spam older than N days), admin delete, eraser |
| `participants` | Who took part | PK `(conversation_id, participant_type, participant_ref)` | with conversation |
| `messages` | Public messages | `public_id` UNIQUE; `idempotency_key` UNIQUE (SHA-256 of visitor + client key); `delivery_state`; cursor key `(conversation_id,id)` | with conversation |
| `notes` | Internal notes (separate table so no visitor query can read them) | `(conversation_id,id)` | with conversation |
| `attachments` | File metadata; bytes in private storage | `public_id` UNIQUE; random `storage_name` (`<40 hex>.bin`); detected `mime`; `sha256`; `status` pending/ready | with conversation (files unlinked first); orphan purge after 24 h |
| `operators` | Chat operators | `wp_user_id` UNIQUE; `telegram_user_id` UNIQUE; `availability`, `availability_until`, `last_heartbeat_at`, `max_concurrent` | manual |
| `teams`, `team_members` | Teams and membership | `slug` UNIQUE; optional `destination_chat_id` | manual |
| `assignments` | Assignment history | `(conversation_id)`, `(operator_id,ended_at)` | with conversation |
| `provider_messages` | Telegram message ↔ conversation map | UNIQUE `(provider, account_id, chat_id, provider_message_id)`; `part_index`; `direction` in/out | with conversation |
| `provider_threads` | Forum topic ↔ conversation map | UNIQUE `(provider, account_id, chat_id, thread_id)`; `state` open/closed/deleted | with conversation |
| `outbox` | Durable delivery jobs | `status`, `available_at`, `lease_token`, `lease_expires_at`, `attempts`, `progress` (per-part JSON), `ordering_key`; keys `(status,available_at)`, `(ordering_key,status,id)` | done/cancelled after 7 days, dead after 30 days |
| `inbound_updates` | Durable webhook log | UNIQUE `(provider, account_id, update_id)`; lease fields; `result_code` | processed/ignored/failed after 14 days |
| `rules`, `trigger_executions` | Targeting rules; exposure log | `(status,priority)`; `(rule_id,created_at)`, `(visitor_id,rule_id)` | executions after 180 days |
| `tags`, `conversation_tags` | Tags | `slug` UNIQUE; PK pair | with conversation |
| `ratings` | CSAT | `conversation_id` UNIQUE | with conversation |
| `events` | Audit log (redacted) | `(event,created_at)`, `conversation_id` | after `event_retention_days` |
| `challenges` | One-time enrollment codes | `code_hash` UNIQUE (HMAC), `expires_at` (10 min), `used_at` | 1 day after expiry |
| `rate_limits` | Fixed-window counters | PK `(bucket, window_start)` | after 1 day |
| `canned_replies`, `kb_articles` | Content | `shortcut` UNIQUE | manual |

## Conversation states

```
pending ──visitor msg──▶ queued ──claim/auto──▶ assigned ──operator reply──▶ waiting ◀──┐
   │                        │                      │                          │        │
   └──────────────┬─────────┴──────────────────────┴──── visitor msg ──▶ open ─┘ operator reply
                  ▼
               closed ──visitor or operator writes──▶ reopened ──▶ (assigned | queued | waiting | closed)
any active state ──▶ spam ──▶ queued | closed
```

Allowed transitions are enforced in `Domain/ConversationStatus::allowed_next()`; every transition is a conditional `UPDATE … WHERE status = <expected>` so concurrent writers get a `409 conflict` instead of overwriting each other.

## Delivery state vs read state

| `messages.delivery_state` | Meaning |
|---|---|
| `local_accepted` | Stored in WordPress; relay not configured |
| `queued` | Outbox job exists |
| `partially_sent` | Some chunks/attachments accepted by Telegram |
| `provider_accepted` | Telegram returned `ok:true` for every part. **Not** proof that a person read it |
| `uncertain` | Request may have reached Telegram (timeout); held for review |
| `failed` | Permanent error or retries exhausted |
| `not_applicable` | Operator replies, automation, spam |

Website read state is separate: `conversations.visitor_read_id` / `operator_read_id` (monotonic, `GREATEST()`), set only by real widget/inbox activity. Telegram read receipts, typing and online status do not exist in the Bot API and are not invented.

## Atomicity

* A visitor message, its attachment links, the conversation transition and the outbox job are written in **one transaction** (`Domain/Messages::create_visitor_message`).
* Idempotency: the UNIQUE `idempotency_key` makes retries of the same client message return the original (`200` + `duplicate:true`).
* Claims: `UPDATE … SET assigned_operator_id = :me WHERE id = :id AND assigned_operator_id IS NULL` — exactly one winner (verified with 10 concurrent processes).
* Outbox/inbound claiming: conditional `UPDATE` with a random lease token and expiry; completion is conditional on the token (a stale worker cannot overwrite).
