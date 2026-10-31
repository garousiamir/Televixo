# Implementation status

Legend: ✅ implemented and verified · 🟡 implemented, partially verified or partial scope · ⛔ blocked (external prerequisite) · ➖ intentionally not provided

Evidence keys: **PU** = PHPUnit (`tests/php`), **JS** = `tests/js`, **E2E** = `tests/e2e/run.mjs`, **CC** = `tests/concurrency/run.sh`, **CI** = clean install of `dist/televixo.zip`, **VR** = visual comparison, **AX** = axe-core.

## 0. Product & process

| Requirement | Status | Implementation | Evidence / blocker |
|---|---|---|---|
| Brand, slug, text domain, REST namespace, PHP namespace | ✅ | `televixo`, `televixo/v1`, `Televixo\` | CI |
| English default, translatable incl. Persian RTL | 🟡 | POT (750 strings), `fa_IR` .po/.mo (132 visitor strings), admin JSON | E2E 6; admin strings not translated to Persian |
| Inspect repo/instructions, preserve work | ✅ | repo had README + reference only; nothing removed | git history |
| Official docs; matrix + sources in capabilities.md | 🟡 | `docs/capabilities.md` | docs sites blocked; Telegram verified from official server source |
| Supported matrix, graceful failure | ✅ | `Core/Requirements.php`, main file guard | CI (simulated) |
| Phased work through packaging | ✅ | commits per phase | git log |

## 1. HTML reference

| Requirement | Status | Evidence |
|---|---|---|
| Inspect files, render in browser | ✅ | rendered offline with pinned npm deps (`tests/visual/compare.mjs`) |
| Treat scripts as untrusted | ✅ | inspected: no network/tracking; rendered with all external requests blocked |
| Identify covered surfaces | ✅ | chat panel + "Start chat" pill only (`docs/design-system.md`) |
| Extract tokens | ✅ | `docs/design-system.md`, `assets-src/widget/styles.css` |
| Preserve visual language; extensions identified | ✅ | design-system "Extensions" table |
| Replace demo interactions with real behaviour | ✅ | widget talks to REST; no canned replies |
| Asset redistribution rights | ✅ | reference images not shipped; OFL fonts bundled (`docs/sbom.md`) |
| Screenshots at desktop/tablet/mobile incl. RTL | ✅ | `docs/visual/compare-*.png`, VR |
| Document deviations | ✅ | design-system "Intentional deviations" |
| Final visual acceptance | 🟡 | pending product-owner sign-off |

## 2. Architecture

| Requirement | Status | Implementation |
|---|---|---|
| Modular OOP PHP + autoloading | ✅ | `includes/{Core,Domain,Persistence,REST,Telegram,Provider,Queue,Security,Rules,Automation,Reporting,Privacy,Admin,Widget,CLI}` (Routing logic lives in `Telegram/UpdateProcessor` + `Domain/Assignment`) |
| Custom tables, native APIs | ✅ | `Persistence/Schema.php` |
| Lightweight TS widget, scoped CSS | ✅ | Shadow DOM; 21.9 KB gz JS |
| React/TS admin with WP packages | ✅ | `assets-src/admin`, `wp.element`/`apiFetch`/`i18n` |
| Adaptive cursor polling | ✅ | `widget/poller.ts` (E2E 1–2) |
| Durable background queue | ✅ | own outbox with leases (Action Scheduler not bundled to avoid version collisions; equivalent tested implementation) — PU DeliveryTest, CC |
| Shared hosting, no SaaS/Node/Redis/WebSocket at runtime | ✅ | CI |
| Provider interface + normalized model | ✅ | `Provider/ProviderInterface`, `DeliveryResult`, `InboundMessage`, `Registry` |
| Independent of Gapban | ✅ | no references |

## 3. Database & state

| Requirement | Status | Evidence |
|---|---|---|
| All listed tables, prefix, versioned migrations | ✅ | `docs/data-model.md`; PU LifecycleTest |
| Fields, indexes, retention, deletion explicit | ✅ | data-model table |
| Random public IDs, separate secrets, hashed tokens | ✅ | PU SecurityTest |
| Large provider IDs | ✅ | VARCHAR(32), `JSON_BIGINT_AS_STRING` (PU classification) |
| Composite unique mappings, unique update IDs, idempotency keys | ✅ | schema; PU |
| Immutable routing snapshots | ✅ | PU Topics `test_changing_default_mode…` |
| UTC storage, localized display | ✅ | `Core/Clock`, `Intl` in UI |
| Indexed cursor pagination, no unbounded queries | ✅ | messages `(conversation_id,id)`, inbox keyset `(last_message_at,id)`; PU Inbox pagination |
| Atomic assignment & job claiming with leases | ✅ | PU + CC |
| Message + outbox atomic | ✅ | single transaction |
| Conversation states & transitions | ✅ | `ConversationStatus`; PU |
| Delivery vs read state distinct; no invented Telegram presence/read/typing | ✅ | data-model |

## 4. REST

| Requirement | Status | Evidence |
|---|---|---|
| All listed endpoints | ✅ | `docs/rest-api.md` |
| Schemas, validation, limits, stable codes | ✅ | rest-api.md; PU |
| permission_callback everywhere | ✅ | `Controller::route()` requires one; PU Inbox caps |
| Admin caps + CSRF | ✅ | wp_rest nonce |
| Real anonymous session auth (not guest nonce) | ✅ | `SessionManager` |
| Ownership on everything | ✅ | PU 20-visitor, files |

## 5. Telegram & routing

| Requirement | Status | Evidence |
|---|---|---|
| Server-side Bot API only | ✅ | `Telegram/BotApi` |
| Setup: token/getMe, destination, enrollment, allowlists, permission/privacy/forum checks, test message, webhook set/status/remove, replace warning, private-chat instructions | ✅ | `REST/SetupController`, `admin/setup.tsx`; PU Lifecycle (webhook ownership, topics checks) — 🟡 extra allowlisted chat IDs are settings-only (no UI field) |
| Reply Mode (all bullets) | ✅ | PU ReplyModeTest (10 tests) |
| Topics Mode (all bullets) | ✅ | PU TopicsModeTest (8 tests) |
| Mode change affects new conversations only | ✅ | PU |
| Explicit admin-triggered migration between modes | ➖ | not offered; automatic supergroup migration is validated and audited |
| Callback authorization independent | ✅ | PU |
| Reject anonymous/unidentifiable, ignore echoes/service messages | ✅ | PU |
| Real Telegram verification | ⛔ | no credentials; `api.telegram.org` blocked |

## 6. Durable delivery

| Requirement | Status | Evidence |
|---|---|---|
| Store before contacting Telegram; record webhook before ack | ✅ | PU Reply/Webhook |
| Dedup, retries, backoff+jitter, retry_after | ✅ | PU Delivery |
| Permanent / retryable / uncertain separation | ✅ | `BotApi::classify`; PU |
| Timeouts, malformed, expired creds, 429, permissions, deleted destinations, oversize, partial sends | ✅ | PU Delivery + Topics |
| Per-conversation ordering | ✅ | PU + CC |
| Dead-letter inspection, manual retry | ✅ | admin Delivery & health, WP-CLI |
| Crash/lease recovery | ✅ | PU + CC (SIGKILL) |
| No exactly-once claim; ambiguity documented | ✅ | `docs/delivery.md` |
| Immediate bounded path + background + cron docs + health warnings | ✅ | `Queue/Scheduler`, `docs/cron.md` |
| Visitor polling: visibility, backoff, reconnect, dedup, tab coordination | ✅ / 🟡 | E2E 1–2; network-loss reconnect not automated |

## 7. Chat experience

| Requirement | Status | Evidence |
|---|---|---|
| Guest + logged-in continuity | ✅ | PU session binding; E2E refresh |
| Pre-chat fields, required config, offline form | ✅ | `widget.ts` forms; PU validation via REST — 🟡 no browser E2E for forms |
| Text, emoji, multiline, links, uploads with preview/progress/cancel/retry | ✅ / 🟡 | code + PU upload security; upload UI not covered by E2E |
| Voice (explicit permission, Telegram formats, fallback) | 🟡 | implemented; not testable headless (no microphone) |
| Grouping, timestamps, day separators, unread badge, scroll-to-latest, older history, connection states | ✅ | E2E screenshots; badge in E2E 1 |
| Drafts with expiry, multi-tab | ✅ / 🟡 | code; not E2E-asserted |
| Minimize/close/reopen, expanded desktop, mobile full screen | ✅ | E2E 3, 6 |
| Sound (autoplay-aware), optional notifications after consent | 🟡 | code-reviewed |
| KB cards/search, suggested questions, canned answers | ✅ | `KnowledgeBase`, chips, admin canned |
| Human handoff from welcome flow | ✅ | `Automation/Welcome` — 🟡 not E2E |
| Queue/offline truthful availability; hours, holidays, timezone, away | ✅ | PU Lifecycle availability + DST |
| CSAT + comment, transcript download with ownership | ✅ | REST + widget; PU (rating endpoint via code) |
| Blocking, abuse report, spam handling | ✅ | PU |
| Public messages vs internal notes | ✅ | separate table; PU |
| Typing/read only from real web/admin activity; presence from availability/heartbeat | ✅ | data-model |
| No mandatory AI, no omnichannel claims | ✅ | — |

## 8. Launcher

| Requirement | Status |
|---|---|
| Left/right + logical start/end, desktop/mobile offsets & sizes, safe-area | ✅ (E2E RTL side) |
| Circle/pill, sanitized custom SVG, avatar, label, online dot, unread badge | ✅ (PU SVG) |
| Greeting bubble/teaser | ✅ (E2E 4) |
| Hover/focus/pressed/offline states | ✅ — 🟡 no separate "loading" spinner state; widget disabled = not rendered |
| Entrance + one-shot attention animation, reduced motion, disable switch | ✅ |
| Collision avoidance (cookie banners, mobile nav via selectors, checkout buttons) | 🟡 implemented; not E2E-asserted |
| Sensible z-index (default 9990, configurable) | ✅ |
| Responsive + instant settings preview | ✅ (admin screenshot) |

## 9. Targeting & behaviour builder

| Requirement | Status | Evidence |
|---|---|---|
| Visual editor: nested AND/OR, exclusions, priorities, validation, import/export, "why matched" | ✅ | `admin/rules.tsx`; PU Rules |
| All listed conditions; no fingerprinting; desktop-only exit intent | ✅ | `docs/targeting.md`; JS + PU vectors |
| WooCommerce conditions only when active | 🟡 | implemented; WooCommerce not installable offline |
| Actions | ✅ | |
| Deterministic precedence, exclusions, conflicts | ✅ | shared resolution fixture (PU + JS) |
| Re-evaluate on navigation | ✅ | history hooks |
| Delay, visible time, caps, cooldown, expiry, cross-tab suppression, stop conditions, no reopen after dismissal, consent | ✅ / 🟡 | E2E 4 (caps/persistence); consent API code-reviewed |
| Required pricing example verified across refresh & navigation | ✅ | E2E 4 |

## 10. Inbox & administration

| Requirement | Status |
|---|---|
| All listed screens | ✅ (E2E screenshots of 9 screens) |
| Inbox search, filters, unread, pagination, tags, priority | ✅ — 🟡 tag filter in API only (no UI selector) |
| Claim/transfer/teams/manual/round-robin/load; atomic conflicts | ✅ (PU + CC) |
| Granular capabilities, server-side | ✅ (PU) |
| Group visibility explained; separated destinations | ✅ (setup notice, team destination) |
| Reports with defined calculations | ✅ (`docs/reports.md`, PU) |

## 11. Security, privacy, performance

| Requirement | Status |
|---|---|
| Validation/sanitization/escaping, prepared SQL, ownership | ✅ (PHPCS security ruleset clean; PU) |
| XSS, SQLi, CSRF, IDOR, SSRF, replay, exhaustion | ✅ (`docs/security.md` table) |
| Webhook secret constant-time; allowlists after auth | ✅ |
| Sessions, no credentials in URLs | ✅ (E2E 5) |
| Rate limits, body bounds, quotas, honeypot, CAPTCHA adapter, proxy-aware IP | ✅ |
| No token/secret leakage; redaction | ✅ |
| Authenticated encryption, key/rotation strategy, config overrides | ✅ |
| Provider host allowlist, no redirects, no proxy URL | ✅ |
| Upload MIME inspection, random names, executable blocking, quotas, safe headers, private storage + reachability probe | ✅ (PU) — 🟡 probe verified manually only |
| SVG disallowed for uploads; icon sanitizer | ✅ |
| Remote media fetch limits | ✅ (20 MB, getFile path validation) |
| Retention, cleanup, exporters/erasers, consent text, Telegram deletion limits | ✅ (PU) |
| No telemetry/external fonts | ✅ (E2E request log) |
| Cache isolation | ✅ (E2E 5) |
| Admin assets only on plugin pages; minimal bootstrap on excluded pages | ✅ (0 queries / no script on excluded pages) |
| Measured budgets | ✅ (`docs/test-report.md`) |
| WCAG 2.2 AA target | 🟡 axe: 0 violations; keyboard flow E2E; no manual screen-reader audit |
| Strings translatable (plural/context), POT, Persian RTL | ✅ / 🟡 (see §0) |
| Local assets, no CSS leakage | ✅ (Shadow DOM, `.tvxa` scope) |

## 12. Testing

See `docs/test-report.md`. Real-provider tests ⛔ blocked; WooCommerce/page-builder compatibility ⛔ blocked; PHP 8.2/8.4/8.5 and MySQL ⛔ not available in this environment.

## 13. Release

| Deliverable | Status | Location |
|---|---|---|
| Source + reproducible build | ✅ | `assets-src/`, `bin/build.mjs`, `bin/package.php`, lockfiles |
| Installable zip (one `televixo/` dir, compiled assets, no dev deps) | ✅ | `dist/televixo.zip` (CI) |
| Full distribution archive | ✅ | `dist/televixo-full-1.0.0.zip` |
| README, quick start, admin & operator guides, REST/data model, threat model, troubleshooting, hosting, cron | ✅ | `README.md`, `docs/` |
| Localization files | ✅ | `televixo/languages/` |
| SBOM/licenses/attribution | ✅ | `docs/sbom.md`, font OFL files, `LICENSE.txt` |
| Privacy/data-flow | ✅ | `docs/privacy.md` |
| Test report, screenshots, visual comparison, limitations | ✅ | `docs/test-report.md`, `docs/screenshots/`, `docs/visual-comparison.md`, `docs/known-limitations.md` |
| Envato checklist | 🟡 | `docs/envato-checklist.md` (official page not fetchable) |
| Excludes credentials, test data, caches, node_modules, unrelated files | ✅ | package excludes; reference HTML excluded |
| Deactivation/uninstall behaviour, safe webhook cleanup | ✅ | CI + PU |
| Licensing/update server | ➖ | not included (none specified; no fabricated purchase validation) |

## Commands used for verification

```bash
composer install && npm ci && npm run build
WP_CORE_DIR=/path/to/wordpress-7.1.4 vendor/bin/phpunit
npm run test:js
vendor/bin/phpcs
BASE=http://127.0.0.1:8899 node --test --test-concurrency=1 tests/e2e/run.mjs   # needs the seeded test site
tests/concurrency/run.sh
node tests/visual/compare.mjs
php bin/package.php
```

## Release readiness

**Not yet ready for marketplace submission.** The plugin is functionally complete for its specified scope and passes all automated checks available in this environment, but these blockers remain: real Telegram sandbox verification, WooCommerce/theme/page-builder compatibility runs, PHP 8.2/8.4/8.5 and MySQL runs, visual sign-off by the product owner, a manual screen-reader pass, and re-checking the Envato and Telegram documentation once accessible.
