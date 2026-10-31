# Targeting & proactive messages

Rules are evaluated **in the visitor's browser** (`assets-src/widget/rules.ts`) because page HTML may be cached and behavioural signals only exist client-side. The PHP evaluator (`Rules/Engine.php`) is the reference used for admin previews and validation. Both run the same vectors (`tests/fixtures/rule-vectors.json`, `rule-resolution.json`).

## Definition

```json
{
  "conditions": {"op": "and", "negate": false, "items": [ Condition | Group ]},
  "exclusions": Group | null,
  "actions": [ {"type": "teaser", "text": "…"} ],
  "frequency": {"per_page": 1, "per_session": 1, "per_visitor": null, "cooldown_hours": 24, "expires_at": "YYYY-MM-DD"},
  "stop": {"on_reply": true, "on_typing": true, "on_close": true, "on_human": true, "if_opened": true}
}
```

Validation (`Rules/Schema.php`): ≤ 4 nesting levels, ≤ 30 items per group, known types/operators only, values sanitized; wildcards must start with `/` and contain ≤ 5 `*`.

## Conditions

| Source | Conditions |
|---|---|
| Page (from the server, identical for every visitor of a URL, cache-safe) | `site`, `page_id`, `post_type`, `template`, `term` (`taxonomy:ID`), `page_kind` (front, home, archive, search, 404, singular), `language`, `woo_page` (shop, product, cart, checkout, account), `woo_product`, `woo_category` |
| Session (from `POST /session`, no-store) | `logged_in`, `role`, `cart_value`, `cart_items` (WooCommerce only), `availability`, `conversation_state` (none, active, closed) |
| Browser | `url` (equals, contains, safe wildcard), `query` (exists, equals), `device` (from viewport width + pointer), `viewport_width`, `visitor_type` (first-party flag), `referrer_host` (host only; same-site referrers ignored), `utm_source/medium/campaign`, `business_hours` (computed in the configured time zone), `trigger_seen` (within/not within N hours), `chat_opened` |
| Behaviour | `time_on_page` (visible time only; paused while the tab is hidden), `scroll_depth`, `inactivity`, `exit_intent` (desktop with a fine pointer only — never guessed on mobile) |

Visitors are never fingerprinted.

## Actions & precedence

Actions: show/hide launcher, teaser, open chat, clearly-labelled automated message, select department, change greeting.

1. Global excluded paths (Widget settings) — no widget code is loaded at all.
2. A rule whose exclusions match never applies.
3. Rules are ordered by priority (higher first), then ID (lower first).
4. Each slot is filled by the first matching rule: `launcher`, `attention` (teaser / open chat / automated message — **one per page view**), `department`, `greeting`.
5. For `launcher` at equal priority, *hide* wins over *show*.

Rules are re-evaluated every second (behaviour), on scroll, and on in-page navigation (`pushState`, `replaceState`, `popstate`). Single-page apps can call `televixo.updatePage({...})` to refresh page facts.

## Frequency & stopping

Caps are stored in first-party browser storage (`televixo:v1:*` keys): per page (in memory), per session (`sessionStorage`), per visitor and cooldown (`localStorage`, 400-day expiry). A 15-second cross-tab lock prevents two tabs from showing a prompt at once. Stop conditions: visitor sent a message, started typing, closed the chat or dismissed a prompt (no reopening for the rest of the session), a human already replied, or the chat was already opened.

If the site sets `window.televixoConsent = false` before the widget loads, no browser storage is used and proactive prompts stay off until `televixo.setConsent(true)` is called (e.g. from a consent banner).

## Required example (verified in E2E)

*On the pricing page, after 15 visible seconds, if the visitor has not opened chat and has not seen this campaign in 24 hours, show a targeted greeting once.*

```json
{"conditions":{"op":"and","items":[
  {"type":"url","operator":"wildcard","value":"/pricing*"},
  {"type":"time_on_page","operator":"gte","value":15},
  {"type":"chat_opened","operator":"is","value":false},
  {"type":"trigger_seen","operator":"not_within_hours","value":{"rule":0,"hours":24}}]},
 "actions":[{"type":"teaser","text":"Questions about our plans? We reply in minutes."}],
 "frequency":{"per_page":1,"cooldown_hours":24}}
```

E2E test 4 checks: not shown at 10 s, shown by 19 s, not shown again after refresh, not shown after navigating away and back.

## "Why did this match?"

Targeting → *Why does a rule match?* posts a simulated context to `POST /admin/rules/preview` and shows every condition with its expected value, the actual value and the result, plus the effective action per slot.

## Reporting

When a session exists, the widget records `shown`, `clicked` and `dismissed` events. Reports compute conversion as visitors shown an attention action who started a conversation within 30 minutes. Sessions are never created just for analytics, so first-time visitors who never open the chat are not counted.
