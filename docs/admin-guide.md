# Administrator guide

## Screens

| Screen | Capability | What it does |
|---|---|---|
| Inbox | handle assigned / view all | Conversations, replies, notes, claim/transfer, status, tags, priority, visitor context, block, export, delete |
| Setup | manage settings | Bot token, destination and checks, webhook, test message, link your Telegram |
| Operators & teams | manage settings | Operators (status, capacity, teams, Telegram link, enrollment codes), teams (strategy, separate destination) |
| Widget | manage settings | Launcher, window texts, offsets, sizes, colours, animations, collision selectors, excluded paths, live preview (desktop/tablet/mobile, RTL) |
| Targeting | manage settings | Rules builder, import/export, "why does a rule match?" |
| Replies & FAQ | manage settings | Canned replies, help articles, welcome flow, suggested questions |
| Settings | manage settings | Routing, pre-chat, hours/holidays/away, offline behaviour, files/voice, CSAT, privacy/retention, limits, trusted proxies, import/export |
| Reports | view reports | KPIs, daily volume, operators, teams, automation conversion |
| Delivery & health | manage settings | Queue counts, failed/uncertain jobs with retry/discard, worker status, cron instructions, redacted diagnostics |

## Capabilities

| Capability | Default holders | Allows |
|---|---|---|
| `televixo_manage_settings` | Administrator | All configuration screens |
| `televixo_handle_assigned` | Administrator, **Chat Operator** role | Inbox: own conversations and unassigned ones of their teams (or with no team) |
| `televixo_view_all` | Administrator | All conversations, transfers, supervisor actions |
| `televixo_view_reports` | Administrator | Reports |
| `televixo_export` | Administrator | Conversation JSON export |
| `televixo_delete` | Administrator | Delete conversations, run retention |

Grant capabilities to other roles with any role editor. Every REST route checks them on the server; hiding UI is not relied on.

## Routing modes

* **Reply Mode** — each visitor message is posted with a header (`💬 C-XXXX · Name`, page path on the first message) and Claim/Close buttons. Operators must *Reply* to a relayed message (or to another operator's reply); plain group messages are ignored. Works with privacy mode on.
* **Topics Mode** — one forum topic per conversation (`C-XXXX · Name`). Messages from enrolled operators inside the topic are sent to the visitor (or only explicit replies, per *Topics Mode forwarding*). Closing the conversation closes the topic; deleted topics are recreated when the visitor writes again (setting).
* Changing the mode or destination affects **new** conversations only; existing ones keep their routing snapshot. Old destinations remain authorized so replies to earlier conversations still work. Group → supergroup migrations are applied automatically and audited.

## Assignment

Manual (claim), round robin or least busy — globally or per team. Automatic strategies only consider operators who are **present** (explicit *Available* plus a recent inbox heartbeat, or a Telegram `/online` within 8 hours) and below their capacity. Claims and transfers are atomic: a second operator gets "Another operator already took this conversation".

## Availability shown to visitors

*Away* (manual switch) > *Closed* (outside business hours or holiday, with next opening time) > *Online* (an operator is present) > *Offline*. If *Require an online operator* is off, the widget says "Within business hours" rather than claiming someone is online.

## Privacy & retention

Retention deletes closed/spam conversations after N days (files included). Exports exclude secrets. Uninstall deletes data only when *Delete all Televixo data when the plugin is deleted* is enabled; deactivation never deletes data. The webhook is removed on uninstall only if it still points at this site.

## WP-CLI

```bash
wp televixo worker [--seconds=55] [--loop]
wp televixo queue status|list [--status=dead]|retry <id>
wp televixo maintenance
wp televixo secrets status|rotate
```

## Hooks for developers

* `televixo_verify_captcha` (filter, `bool $ok, WP_REST_Request $r, string $context`) — plug in a CAPTCHA provider.
* `televixo_load_widget` (filter) — suppress the widget on custom conditions.
* `televixo_providers` (filter) — register an additional `Provider\ProviderInterface`.
* Actions: `televixo_visitor_message_created`, `televixo_operator_message_created`, `televixo_conversation_status_changed`, `televixo_conversation_assigned`.
* Browser API: `televixo.open()`, `close()`, `toggle()`, `show()`, `hide()`, `setConsent(bool)`, `updatePage(ctx)`, `on('ready'|'open'|'close'|'trigger', fn)`; window events `televixo:<name>`.
