# Privacy & data flow

```
Visitor browser ──HTTPS──▶ WordPress (your server) ──HTTPS──▶ api.telegram.org ──▶ Telegram group / operator
      ▲  session cookie (HttpOnly)          │  database + private files            ▲
      └──────────── polling (no-store) ─────┘                                      └── operator replies (webhook)
```

## Stored in WordPress

| Data | Where | Retention |
|---|---|---|
| Messages, notes, ratings | custom tables | deleted with the conversation (retention setting, default 365 days after closure; 0 = keep) |
| Files | private storage directory | deleted with the conversation; unattached uploads after 24 h |
| Name, email, phone, custom fields, consent time and text hash | `visitors` | until the visitor has no conversations and was last seen before the retention period |
| Page path (no query string), page title, referrer host, UTM values, device class | `conversations.context` | with the conversation |
| Network hash (HMAC of IP; raw IPs are never stored) | `visitors`, `sessions` | with the visitor / session |
| Session token hash | `sessions` | 7 days after expiry |
| Audit events (redacted) | `events` | `event_retention_days` (default 365) |

## Sent to Telegram

For each relayed message: the text, attachments, and the context fields the administrator selected (default: name and page path; optional email, phone, department, referrer). Everything relayed is stored by Telegram and visible to every member of the destination chat. **Deleting a conversation in WordPress does not delete copies in Telegram**; the eraser response says so.

## Browser storage

* Cookie `televixo_session` (HttpOnly, SameSite=Lax, Secure on HTTPS, 30 days sliding) — only after the visitor opens the chat or a rule needs session data.
* `localStorage`/`sessionStorage` keys prefixed `televixo:v1:` — first-visit date, returning flag, drafts (24 h), sound preference, prompt exposure history, "has session" hint, tab leader heartbeat. No identifiers that work across sites; no fingerprinting.
* `window.televixoConsent = false` disables browser storage and proactive prompts until consent.

## WordPress privacy tools

* **Export Personal Data**: conversations (with transcript) and profile for visitors matched by email or WordPress account.
* **Erase Personal Data**: deletes matching visitors, their conversations, files and sessions.
* Suggested policy text is added to Settings → Privacy → Policy Guide.

## No telemetry

Televixo makes no network requests other than to `api.telegram.org` (and an optional loopback request to your own site to start the worker). Fonts are bundled locally; no CDN, analytics or update server is contacted.
