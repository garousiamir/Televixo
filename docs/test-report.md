# Test report

Run date: 2026-10-31. Environment: PHP 8.3.6, MariaDB 10.11.14, WordPress 7.1.4 (GitHub mirror tag), Chromium via Playwright, Node 22.23.

## Results by category

| Category | Result | Evidence |
|---|---|---|
| **Automated – PHP integration** (real WordPress test suite + MariaDB) | ✅ 80 tests, 593 assertions, 0 failures | `vendor/bin/phpunit` (`tests/php/*`) |
| **Automated – JavaScript** (rule vectors shared with PHP, plural parser) | ✅ 4 tests | `npm run test:js` |
| **Automated – browser E2E** (real WordPress site, plugin + fake Bot API) | ✅ 8 scenarios | `node --test tests/e2e/run.mjs` |
| **Automated – multi-process concurrency** (separate DB connections) | ✅ 10 concurrent claims → 1 winner; 4 concurrent workers share 40 jobs, 40 unique sends, per-conversation order kept; SIGKILLed worker recovered after lease expiry with no duplicate | `tests/concurrency/run.sh` |
| **Automated – accessibility** (axe-core 4.10, WCAG 2.0/2.1/2.2 A+AA rules on open widget) | ✅ 0 violations, 21 passes | `docs/axe-widget.json` |
| **Release archive clean install** | ✅ install from `televixo.zip`, activate (25 tables, 2 cron events, 71 routes), deactivate (cron stopped, data kept), reactivate, uninstall default (data kept), opted-in uninstall (tables/options/caps/role removed) | see commands in `implementation-status.md` |
| **Unsupported environment** | ✅ (simulated by raising the PHP floor) admin notice, nothing loaded | — |
| **Visual comparison** | ⚠️ compared, documented, sign-off pending | `visual-comparison.md` |
| **Real Telegram (sandbox) tests** | ⛔ **blocked** — no bot credentials and `api.telegram.org` blocked by this environment's network policy | — |

## Mandatory scenarios

| Scenario | Status | Test |
|---|---|---|
| Twenty concurrent visitors, zero leakage | ✅ (interleaved, sequential requests) | `ReplyModeTest::test_twenty_concurrent_visitors_no_leakage` |
| Replies to old and chunked messages | ✅ | `test_operator_reply_reaches_only_the_right_visitor`, `test_reply_to_any_chunk…` |
| Reply Mode and Topics Mode independent | ✅ | `TopicsModeTest::test_changing_default_mode_keeps_existing_snapshots` |
| Changing routing defaults keeps old conversations | ✅ | same + allowlist fix |
| Duplicate / out-of-order webhooks | ✅ | `test_duplicate_and_out_of_order_updates`, `WebhookTest` |
| Worker crash | ✅ | `test_crashed_worker_lease…` + SIGKILL race |
| Concurrent claims | ✅ | `InboxTest` + 10-process race |
| Provider outage & recovery, rate limit, timeout ambiguity, partial sends | ✅ | `DeliveryTest` |
| Forged webhooks, unauthorized operators, expired sessions, cross-session history/file access | ✅ | `WebhookTest`, `ReplyModeTest`, `SecurityTest`, E2E 8 |
| Stored XSS, invalid SVG, hostile files, SSRF attempts, oversize requests | ✅ | `SecurityTest` |
| Refresh, multiple tabs, background tab, full-page caching | ✅ (refresh, 2 tabs, cache-safe HTML) | E2E 1, 2, 5 |
| Mobile reconnect | ⚠️ partial — backoff/online handlers covered by code review; network toggling not automated | — |
| Targeting precedence, excluded pages, trigger caps, dismissal, consent | ✅ precedence/caps/excluded/persistence; ⚠️ consent API only code-reviewed | `RulesTest`, JS vectors, E2E 4, 5 |
| Keyboard / screen-reader flow, RTL | ✅ keyboard + axe + fa_IR RTL; ⚠️ no real screen-reader session | E2E 3, 6 |
| Dark mode | n/a — the reference defines no dark theme |
| Fresh install, upgrade migration, deactivation/reactivation, uninstall | ✅ | `LifecycleTest`, clean-install run |
| WooCommerce and theme/page-builder compatibility | ⛔ blocked — WooCommerce/page builders not installable offline; tested only with the default block theme (Twenty Twenty-Five) | — |
| Real Telegram sandbox | ⛔ blocked | — |

## Performance budget (measured)

| Item | Budget | Actual |
|---|---|---|
| `widget.js` gzipped | ≤ 30 KB | 21.9 KB |
| `widget.css` gzipped | ≤ 8 KB | 4.9 KB |
| `admin.js` gzipped (admin screens only) | ≤ 40 KB | 24.5 KB |
| Plugin DB queries on a page with the widget | ≤ 3 | 3 (KB suggestions, KB count, enabled rules) |
| Plugin DB queries on an excluded page | 0 | 0 |
| REST requests for a first-time visitor who does not interact | 0 | 0 (assets + 1 font only) |

## Bugs found and fixed by these tests

* Changing the destination removed the old chat from the allowlist (old conversations orphaned) — `allowed_chats()` now includes chats of existing conversations.
* Round robin tied under load (1-second timestamps) — now ordered by monotonic assignment ID.
* One worker leased every conversation head — batch size reduced so workers share.
* Widget: RTL launcher aligned to the wrong side while open; `role="separator"` inside the message list; button padding overridden by the reset; preview mode attempted a session.
