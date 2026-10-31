# REST API (`televixo/v1`)

Base URL: `/wp-json/televixo/v1/`. All responses carry `Cache-Control: no-store, private` and `X-Content-Type-Options: nosniff`.

**Error envelope** (WordPress standard): `{"code":"<stable_code>","message":"<localized text>","data":{"status":<http>}}`; validation errors add `data.fields` (`{field: message}`).

## Authentication

| Route group | Mechanism |
|---|---|
| Public config, KB | none (non-secret data) |
| Visitor | HttpOnly `televixo_session` cookie (256-bit token, SameSite=Lax, Secure on HTTPS). Mutations also require header `X-Televixo-CSRF` (value returned by `POST /session`). No credential ever appears in a URL. |
| Webhook | `X-Telegram-Bot-Api-Secret-Token` compared with `hash_equals` |
| Admin | WordPress login cookie + `X-WP-Nonce` (`wp_rest`) + Televixo capability + conversation-level access |
| Internal worker | HMAC(timestamp) signed loopback, ±60 s |

Not-found and not-yours return the same `404` (no enumeration).

## Visitor routes

| Method & path | Body / query | Success | Notable errors |
|---|---|---|---|
| `GET /widget/config` | – | public config | – |
| `POST /session` | JSON (required `Content-Type: application/json`) | `{csrf, expires_at, visitor{id,name,has_email}, conversation, availability, context{logged_in, roles, cart_items?, cart_total?}}`; sets cookie | `415`, `413`, `429 rate_limited`, `403 visitor_blocked`, `403 chat_disabled` |
| `DELETE /session` | – | `{ok}`; revokes and clears cookie | `401`, `403 csrf_failed` |
| `POST /conversations` | `{name?, email?, phone?, department?, consent?, fields{}, context{page_path, referrer, utm, …}, website(honeypot)}` | `{conversation, welcome{options[]}|null}` (resumes the active conversation if any) | `422 validation_failed` (+`fields`), `400 rejected` (honeypot), `400 captcha_failed` |
| `GET /conversations/current` | – | `{conversation|null}` | `401` |
| `GET /conversations/{id}/messages` | `after`, `before`, `limit≤50` | `{items[], has_more}` ascending | `404` |
| `GET /conversations/{id}/updates` | `after` (cursor) | `{items[], has_more, conversation, availability}` | `404` |
| `POST /conversations/{id}/messages` | `{body≤limit, client_id (8–64 [A-Za-z0-9_-]), attachments[public ids≤5]}` | `201 {message, duplicate:false, conversation}` / `200 … duplicate:true` | `413 message_too_long`/`payload_too_large`, `400 message_empty`, `429`, `404 attachment_not_found` |
| `POST /conversations/{id}/attachments` | multipart `file` | `201 {attachment}` | `413 file_too_large`, `415 file_type_not_allowed`/`file_content_mismatch`/`file_content_blocked`, `413 quota_exceeded`, `429` |
| `GET /attachments/{id}` | `inline=1` (images only) | bytes, `Content-Disposition`, `nosniff`, sandbox CSP | `404` |
| `POST /conversations/{id}/read` | `{cursor}` | `{ok}` | – |
| `POST /conversations/{id}/typing` | – | `{ok}` (30/min) | – |
| `POST /conversations/{id}/close` | – | `{conversation}` | – |
| `POST /conversations/{id}/rating` | `{score 1–5, comment?≤1000}` | `201` | `422 invalid_score`, `409 already_rated` |
| `POST /conversations/{id}/report` | `{reason}` | `{ok}` | – |
| `GET /conversations/{id}/transcript` | – | `text/plain` attachment | `403 transcript_disabled` |
| `POST /conversations/{id}/welcome` | `{option}` | `{messages, handoff, conversation}` | `422 invalid_option` |
| `POST /offline` | `{name?, email, message, context, client_id?, website}` | `201` | `422`, `429` (5/h per network) |
| `GET /kb` | `q` | `{items[]}` | – |
| `POST /triggers/{rule}/events` | `{action, outcome: shown|clicked|dismissed}` | `{ok}` | `429` |

**Message shape (visitor):** `{id, cursor, author: visitor|operator|automation|system, author_name (operator first name), body (plain text), redacted, created_at (ISO UTC), state: sent|delivered|read|failed|null, attachments[{id,name,mime,kind,size,width,height,url}]}`.

## Webhook

`POST /telegram/webhook` — `403` on a bad/missing secret; `413` above 1 MB; `200 {ok}` only after the update is stored (UNIQUE per bot + `update_id`); duplicates are acknowledged; storage failure returns `500` so Telegram retries; valid JSON without `update_id` → `200 {ignored:"malformed"}`.

## Admin routes (selection; all under `/admin/…`)

| Capability | Routes |
|---|---|
| `televixo_handle_assigned` or `televixo_view_all` | `GET me`, `POST heartbeat {availability?}`, `GET conversations?status=&assigned=me|unassigned&team=&priority=&tag=&q=&cursor=&limit≤50` (keyset cursor `last_message_at_id`), `GET conversations/{id}`, `GET|POST conversations/{id}/messages`, `POST conversations/{id}/attachments`, `GET|POST conversations/{id}/notes`, `POST conversations/{id}/claim|assign{operator_id,team_id}|unassign|status{closed|spam|reopened|queued}|meta{priority,tags[]}|typing|read`, `POST visitors/{vid}/block`, `GET tags|canned|operators|teams|kb`, `POST operators/{n}/challenge`, `DELETE operators/{n}/telegram` (own account unless settings manager) |
| `televixo_manage_settings` | `GET|POST settings`, `GET settings/export`, `POST settings/import`, `GET|POST|DELETE rules`, `POST rules/preview`, `GET rules/export|schema`, `POST rules/import`, `GET queue?status=`, `POST queue/{n}/retry|discard`, `POST queue/run`, `POST canned|teams|kb|operators…`, `POST visitors/{vid}/unblock`, Telegram setup: `GET telegram/status`, `POST|DELETE telegram/token`, `GET telegram/detected-chats`, `POST telegram/destination{chat_id, mode, save_anyway?}`, `POST telegram/test-message`, `GET|POST|DELETE telegram/webhook{confirm_replace?, force?}`, `GET diagnostics` |
| `televixo_view_reports` | `GET reports?from=YYYY-MM-DD&to=` |
| `televixo_export` | `GET conversations/{id}/export` |
| `televixo_delete` | `DELETE conversations/{id}`, `POST privacy/run-retention` |

Conflicts return `409` with `already_claimed`, `conflict`, `invalid_transition`, `webhook_in_use`, `bot_change_confirm` or `webhook_not_ours`.

## Limits

JSON bodies ≤ 64 KB (webhook ≤ 1 MB); message length default 4000 characters (setting); 20 messages/min per session and 60/min per network; 20 sessions/h per network; 20 uploads/h per session; per-conversation storage quota (default 50 MB); history pages ≤ 50.
