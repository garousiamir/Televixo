# Security & threat model

## Assets

Visitor messages, files and contact details; operator identities; the Telegram bot token and webhook secret; WordPress accounts with Televixo capabilities; site availability.

## Trust boundaries

1. **Browser ↔ WordPress (visitor routes)** — untrusted input, anonymous.
2. **Telegram ↔ WordPress (webhook)** — authenticated by secret token, but group members are untrusted.
3. **Admin browser ↔ WordPress** — authenticated WordPress users with varying capabilities.
4. **WordPress → Telegram** — outbound HTTPS to a fixed host.
5. **Database / file system** — trusted, but may be backed up or copied (secrets must not be readable from a dump alone).

## Threats and mitigations

| Threat | Mitigation | Test |
|---|---|---|
| Session theft / fixation | 256-bit random token in HttpOnly, SameSite=Lax cookie (Secure on HTTPS); only HMAC-SHA256(token, server pepper) stored; sliding 30-day expiry; revocation on visitor request, block or WordPress logout; sessions bound to a WordPress user are not reused when logged out or by another user | `SecurityTest::test_session_*` |
| CSRF on visitor routes | Mutations require `X-Televixo-CSRF` = HMAC(token); custom header forces a CORS preflight that is never granted; session creation requires `application/json` | `test_session_token_is_hashed_and_csrf_required`, `test_session_creation_requires_json…` |
| CSRF on admin routes | WordPress `wp_rest` nonce + capability checks on every route | `InboxTest::test_capabilities_enforced_server_side` |
| IDOR (conversations, messages, files) | Ownership check on every visitor route (same 404 for missing and foreign); operator access = view-all, assignee, or unassigned in own team; attachment IDs resolved only if owned and unattached | `test_twenty_concurrent_visitors_no_leakage`, `test_cross_session_file_access_is_denied`, `test_operator_scope…` |
| Forged webhooks / replay | `hash_equals` on the secret header; UNIQUE (bot, update_id) makes replays no-ops; 1 MB body limit | `WebhookTest` |
| Unauthorized Telegram senders | Chat allowlist (destination, configured extras, team chats, chats of existing conversations); individual operator enrollment via one-time HMAC-hashed codes (10 min, single use, atomic consume); anonymous admins and channel senders rejected; WordPress capability re-checked on every update; conversation-level access re-checked | `ReplyModeTest::test_unmapped_unauthorized…`, `test_enrollment_challenge…`, E2E test 8 |
| Mis-routing ("wrong visitor") | Routing only by stored `(bot, chat, message_id)` or `(bot, chat, thread_id)` mappings; snapshot chat must match; reply to another conversation inside a topic is rejected as ambiguous; **no last-active fallback** | `test_reply_inside_other_topic_is_ambiguous`, 20-visitor test |
| Callback button abuse | Payload only names a conversation; sender authorization and chat allowlist are checked independently | `test_callback_buttons_are_authorized_independently` |
| Stored XSS | Visitor/operator text stored raw, rendered with `textContent` in the widget, React text nodes in admin; links created only for http(s) with `rel=noopener noreferrer nofollow ugc`; Telegram sends use no `parse_mode` | `test_stored_xss_is_kept_as_text` |
| Malicious uploads | Server-side `finfo` MIME must match an allowlisted extension; double extensions and executable/script types refused; first 4 KB scanned for PHP/HTML/script markers; images decoded; Office files checked for macros; random `.bin` names; private directory with deny rules; downloads with `nosniff`, sandbox CSP and `attachment` disposition (images inline only) | `test_hostile_files_are_refused` (6 cases) |
| SVG | SVG uploads always refused. Admin-pasted launcher icons pass an allowlist sanitizer (no scripts, handlers, `<use>`, `foreignObject`, entities, `url()`) | `test_svg_icon_sanitizer` |
| Public reachability of files | Deny rules + random directory; diagnostics fetch a canary file over HTTP and show an Nginx rule if reachable; `TELEVIXO_STORAGE_DIR` for out-of-webroot storage | manual (diagnostics) |
| SSRF | Bot API host fixed to `api.telegram.org` over HTTPS; no configurable base URL; redirects disabled; file paths from `getFile` validated (no `..`, no scheme); downloads size-capped (20 MB) | `test_redaction_and_no_custom_api_host` |
| Credential leakage | Token only in the request URL built server-side; `Redactor` strips tokens/secrets from errors, logs, diagnostics and exports; settings export excludes secrets | `test_settings_export_excludes_secrets`, `test_redaction…` |
| Secrets in DB dumps | XSalsa20-Poly1305 (libsodium secretbox) with key from `TELEVIXO_ENCRYPTION_KEY` or HKDF of `AUTH_KEY`+`SECURE_AUTH_KEY`; tampering detected | `test_secrets_encrypted_at_rest_and_rotatable` |
| Spoofed client IPs | `X-Forwarded-For` ignored unless the direct peer is a configured trusted proxy; walked right-to-left | `test_forwarded_ip_ignored_unless_trusted_proxy` |
| Resource exhaustion | Rate limits (sessions/network, messages/session and /network, uploads, typing, offline form, triggers); body size limits; message length limit; upload quotas; bounded history pages; bounded worker time budgets | `test_message_rate_limit`, `test_session_creation…`, `test_oversize_json_body_rejected` |
| Spam / abuse | Honeypot field; optional CAPTCHA adapter (`televixo_verify_captcha` filter); visitor and network blocking; spam status stops relaying | `test_blocked_visitor_and_network`, `test_spam_stops_relay` |
| SQL injection | All queries through `$wpdb->prepare()`; dynamic column names only from fixed lists | code review |
| Cache poisoning / leakage | Page HTML contains only non-personal config; all personal data via `no-store` REST | E2E test 5 (identical HTML with/without session cookie) |

## Keys

* **Preferred:** define `TELEVIXO_ENCRYPTION_KEY` in `wp-config.php` as base64 of 32 random bytes: `php -r 'echo base64_encode(random_bytes(32));'`.
* **Default:** a key derived with HKDF-SHA256 from `AUTH_KEY` and `SECURE_AUTH_KEY` (so a database dump alone cannot decrypt). Changing those salts makes stored secrets unreadable: diagnostics report `undecryptable` and the admin re-enters the token.
* **Rotation:** set the old key as `TELEVIXO_ENCRYPTION_KEY_PREVIOUS`, the new one as `TELEVIXO_ENCRYPTION_KEY`, run `wp televixo secrets rotate`, then remove the previous key.
* **Server override:** `TELEVIXO_TELEGRAM_BOT_TOKEN` in `wp-config.php` (or an environment-backed constant) takes precedence and is never stored.
* Ciphertext format: `tvx1:<key id>:<base64(nonce‖box)>`; key id = first 8 hex of SHA-256 of the key.

## Visitor sessions

See the table above. Additional notes: cookies are only set by REST responses with `no-store`; the widget creates a session lazily (opening the chat or a rule needing session data), so first-time visitors who never interact cause no REST calls and no cookie.

## Group visibility

Everyone in a destination Telegram group can read relayed messages. Televixo does not promise team isolation inside one group. Use per-team destination chats or the WordPress inbox where isolation is required. Setup states this before saving a destination.

## Residual risks

* Telegram has no idempotent send: a crash or timeout after Telegram accepted a message but before Televixo recorded it can produce a duplicate on retry. Timeouts are held as `uncertain` by default to prevent blind resends.
* Operators who leave a team keep Telegram history they already received.
* Self-XSS through the WordPress admin by users with `unfiltered_html` is out of scope.
