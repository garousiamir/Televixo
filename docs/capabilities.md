# Capability & compatibility matrix

Decisions recorded on **2026-10-31**. Where a primary source could not be fetched from this build environment it is marked **(not re-verified)** and must be re-checked before release.

## Network access during this build

The build session's egress policy allowed GitHub, npm and Packagist, but **blocked** `core.telegram.org`, `developer.wordpress.org`, `make.wordpress.org`, `wordpress.org`, `php.net`, `endoflife.date`, `help.author.envato.com` and `api.telegram.org`. Consequences:

* Telegram facts were verified against Telegram's own Bot API server source code (`github.com/tdlib/telegram-bot-api`, commit `e3e9dd8e5b3d7ab8537cd5a10dc31d5ffa8f82d1`, 2026-08-25) instead of the HTML documentation.
* WordPress facts were verified against WordPress source (`github.com/WordPress/WordPress` tag `7.1.4`, `github.com/WordPress/wordpress-develop` trunk).
* PHP/MySQL/MariaDB lifecycle dates come from the vendors' published support policies as known at release time (not re-verified online in this session).
* Envato requirements could not be fetched; see `envato-checklist.md`.
* **No real Telegram API call was made.** All Telegram behaviour is tested against a stateful fake (`tests/php/Support/FakeTelegram.php`, `tests/e2e/mu-plugins/televixo-e2e.php`).

## Supported matrix

| Component | Minimum enforced | Supported / claimed | Tested in this build |
|---|---|---|---|
| WordPress | 6.7 (blocks activation below) | 6.7 – 7.1 | **7.1.4** (current stable tag on GitHub mirror) |
| PHP | **8.2** (blocks below, with admin notice) | 8.2, 8.3, 8.4, 8.5 | **8.3.6** only |
| MySQL | 5.7 (blocks below) | 8.4 LTS and later (8.0 reached end of life in April 2026) | not tested |
| MariaDB | 10.4 (blocks below) | 10.11 LTS, 11.4 LTS and later | **10.11.14** |
| PHP extensions | sodium, json, mbstring, fileinfo (blocks) | + curl/openssl for HTTPS, zip (optional, Office checks) | all present |
| Charset | utf8mb4 (blocks) | utf8mb4 | utf8mb4 |
| Browsers (widget) | ES2019 + Shadow DOM | Last 2 versions of Chrome, Edge, Firefox, Safari (desktop & mobile) | Chromium (Playwright) |
| WooCommerce | optional | conditions activate only when WooCommerce is active | **not tested** (offline: no WooCommerce package) |

### Why PHP 8.2 minimum

PHP 8.1 left security support on 31 Dec 2025. PHP 8.2 receives security fixes until 31 Dec 2026, so it is the lowest branch still supported at release; diagnostics warn on 8.2 (`php_82_security_only`). The code uses no 8.3-only syntax (checked: no typed class constants, `json_validate`, `#[\Override]`). **Runtime verification on 8.2, 8.4 and 8.5 is blocked** (only 8.3 was installed); re-run `composer test` on each.

### Why WordPress 6.7 minimum

WordPress only security-supports the latest major line. 6.7 is chosen as a practical floor that provides React 18 via `wp-element` (`createRoot`), `wp_set_script_translations`, `wp-api-fetch` nonce middleware and script loading strategies (`defer`). `wp-includes/version.php` (7.1.4) declares `$required_php_version = '7.4'` — Televixo's own floor (8.2) is higher and enforced separately.

### Database

Hard floor: MySQL 5.7 / MariaDB 10.4 (InnoDB, `utf8mb4`, transactions, `INSERT … ON DUPLICATE KEY UPDATE`). End-of-life servers above the floor work but diagnostics warn `database_version_eol`. MariaDB's `@@in_transaction` is used to nest transactions safely; on MySQL the query fails silently and a normal transaction is used.

## Telegram Bot API facts used (verified in telegram-bot-api source)

| Fact | Where verified | Used in |
|---|---|---|
| Webhook header `X-Telegram-Bot-Api-Secret-Token` | `WebhookActor.cpp` (`hc.add_header("X-Telegram-Bot-Api-Secret-Token", secret_token_)`) | `REST/WebhookController.php` |
| `secret_token` ≤ 256 chars, base64url alphabet only | `Client.cpp` ("secret token is too long", `is_base64url_characters`) | `Security/Secrets::webhook_secret()` (48 random bytes → 64 base64url chars) |
| `retry_after` in `ResponseParameters`, "Too Many Requests: retry after N" | `Client.cpp` `get_retry_after_time`, `set_retry_after_error` | `Telegram/BotApi::classify()` |
| `migrate_to_chat_id` on group → supergroup upgrade | `Client.cpp` (`parameters.emplace("migrate_to_chat_id", …)`, message field) | `TelegramProvider::migrate_chat()`, `UpdateProcessor` |
| Forum methods `createForumTopic`, `closeForumTopic`, `reopenForumTopic`, `deleteForumTopic`, `editForumTopic` | method table in `Client.cpp` | Topics Mode |
| `message_thread_id`, `is_topic_message`, chat `is_forum`, admin right `can_manage_topics` | `Client.cpp` JSON writers/parsers | routing, setup checks |
| `getMe` fields `can_join_groups`, `can_read_all_group_messages`, `has_topics_enabled` | `Client.cpp` user JSON | setup checks (privacy mode) |
| `getFile` download limit 20 MB (`MAX_DOWNLOAD_FILE_SIZE = 20 << 20`) | `Client.h` | operator file download cap |
| `answerCallbackQuery`, `getChatMember`, `getWebhookInfo`, `setWebhook`, `deleteWebhook`, `sendMessage`, `sendPhoto`, `sendDocument`, `sendVoice` exist | method table | throughout |

Facts **not re-verified** from documentation in this session (used conservatively): text limit 4096 characters and caption limit 1024 (chunks are kept ≤ 3800 UTF‑16 units, captions ≤ 200 chars); upload limits 10 MB for photos (else sent as document) and 50 MB for other uploads (plugin caps visitor uploads at 20 MB); `sendVoice` accepts OGG/Opus, MP3 and M4A; the implicit reply of topic messages to the topic's root service message.

Source URLs to re-check when network allows: <https://core.telegram.org/bots/api>, <https://core.telegram.org/bots/api#setwebhook>, <https://core.telegram.org/bots/api#forum-topic-management>, <https://core.telegram.org/bots/features#privacy-mode>.

## WordPress APIs used

REST API (`register_rest_route` with `permission_callback` on every route), cookie authentication + `wp_rest` nonce for admin routes, `dbDelta`, capabilities/roles API, WP-Cron (`wp_schedule_event`, custom one-minute schedule), personal data exporters/erasers, `wp_add_privacy_policy_content`, `wp_set_script_translations`, script `strategy => defer`, HTTP API (`wp_remote_post`, `pre_http_request` used only by tests), WP-CLI commands.

Source references: `wp-includes/rest-api.php`, `wp-includes/cron.php`, `wp-admin/includes/upgrade.php` (dbDelta), `wp-includes/class-wp-http.php` (7.1.4 tag). Documentation URLs to re-check: <https://developer.wordpress.org/rest-api/extending-the-rest-api/adding-custom-endpoints/>, <https://developer.wordpress.org/plugins/cron/>, <https://developer.wordpress.org/plugins/privacy/>, <https://make.wordpress.org/hosting/handbook/server-environment/>.

## Graceful failure

* PHP or WordPress below the floor: the main file (PHP 5.6-compatible syntax) shows an admin notice and loads nothing (verified by simulation, `docs/test-report.md`).
* Missing extension, database below the floor or non-utf8mb4 connection: activation is refused with an explanatory `wp_die()` (`Core/Requirements::problems()`).
* Non-HTTPS site: the widget and inbox work; webhook registration is refused with a message (Telegram requires HTTPS).
