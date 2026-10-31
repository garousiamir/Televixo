# Envato (CodeCanyon) WordPress plugin checklist

**Author:** pdthemes — <https://pdthemes.de>

**Source status (2026-10-31):** the official article [WordPress Plugin Requirements](https://help.author.envato.com/hc/en-us/articles/360000510603) could not be opened from the build environment (the help-center host is blocked by the network policy). A web search confirmed the article's current sections: WordPress core, database, security, asset loading, installation & uninstallation, translation, PHP, HTML, JavaScript and CSS standards, with a separate Gutenberg page. Related: [Envato forum – Updated WordPress Requirements](https://forums.envato.com/t/updated-wordpress-requirements/173223). The rules below are checked per section from Envato's published requirements as known at release time. **Re-read the live article before submitting.** Passing this list does not guarantee approval.

## Results by section

| Section | Requirement (summary) | Status | Evidence |
|---|---|---|---|
| WordPress core | Use core APIs (REST, HTTP, Filesystem, Cron, roles/capabilities, privacy tools); no core modification | ✅ | `docs/capabilities.md`; files written via `WP_Filesystem` (`Core/Fs.php`) |
| WordPress core | Don't bundle libraries WordPress already ships (jQuery, React) | ✅ | admin uses `wp.element`, `wp.apiFetch`, `wp.i18n` from core |
| WordPress core | No PHP notices/warnings with `WP_DEBUG` | ✅ | E2E run with `WP_DEBUG_LOG`: no plugin entries |
| Database | `$wpdb->prefix`, `dbDelta`, prepared queries | ✅ | `Persistence/Schema.php`, `Db::prepare`; PHPCS `WordPress.DB` clean |
| Security | Capability checks + nonces on every privileged action; sanitize input, escape output | ✅ | every REST route has `permission_callback`; admin-post action uses `check_admin_referer`; PHPCS `WordPress.Security` clean (exception messages are JSON, see below) |
| Security | No `eval`, obfuscation or encoded payloads (`base64_*` flagged) | ✅ | encryption now uses `sodium_bin2base64`/`sodium_base642bin`; no `eval`/`create_function` |
| Security | No remote code, no unexpected external requests or tracking | ✅ | only `api.telegram.org` after admin setup; fonts bundled |
| Asset loading | Enqueue with `wp_enqueue_*`; load only where needed; versioned | ✅ | admin assets only on Televixo screens; front end skipped on excluded pages |
| Installation | Activation creates tables; requirements checked with a clear message | ✅ | `Core/Lifecycle.php`, `Core/Requirements.php`; clean-install test |
| Uninstallation | Keep data when deactivated; `uninstall.php` cleans up | ✅ | deactivation keeps data; uninstall removes tables, options, roles, capabilities and user meta when **Delete all data** is enabled (default keeps data, as the product spec requires) |
| Translation | Text domain = slug, `load_plugin_textdomain`, POT included, translator comments for placeholders | ✅ / ⚠️ | POT regenerated; PHP placeholders have translator comments; minified admin JS loses translator comments (strings still translatable) |
| PHP | Prefix everything; no short tags; no `extract()`; no `@` error suppression; current PHP versions | ✅ | `Televixo\` namespace; `@` removed (uses `wp_getimagesize`, Filesystem API); PHP 8.2+ (`PHPCompatibilityWP` clean except enum false positives) |
| PHP | WordPress coding standards | ⚠️ | security, DB, i18n, prefix rules clean; formatting auto-fixed with `phpcbf`; remaining WordPress-Extra notes are deliberate: PSR-4 file names (`Class.php` instead of `class-*.php`), short ternaries, a 1-minute cron interval (queue) |
| HTML | Valid, accessible, escaped | ✅ | axe: 0 violations; keyboard E2E |
| JavaScript | No global pollution, no console noise, strict, translatable | ✅ | IIFE bundles; only `window.televixo` / `televixoBoot` by design; `console.error` only on fatal widget errors |
| CSS | Prefixed, no theme leakage | ✅ | widget inside Shadow DOM; admin scoped to `.tvxa` |
| Gutenberg | Must not break the block editor ("Gutenberg Optimized" is an optional attribute) | ✅ | the plugin adds no editor scripts; no block shipped (attribute not claimed) |
| Licensing | GPL-compatible; third-party licenses listed; no premium plugins bundled | ✅ | GPL-2.0-or-later; fonts OFL-1.1 (`docs/sbom.md`) |
| Documentation | Help file covering installation, customization and use | ✅ | `documentation/` in the full archive |
| Item metadata | Plugin header with Plugin URI, Author, Author URI, Requires PHP/WP, License, Text Domain | ✅ | `televixo.php`, `readme.txt` (Author: pdthemes, URI: https://pdthemes.de) |
| Admin UX | No intrusive or permanent nags | ✅ | setup notice hidden on plugin screens and permanently dismissible per user |
| Purchase/licensing | No locking, hidden licensing or phone-home | ✅ | none included |

## Deliberate deviations reviewers may ask about

* **Exception messages flagged by `EscapeOutput.ExceptionNotEscaped`:** they are returned as JSON by REST handlers (`WP_Error`), never echoed into HTML.
* **PSR-4 file names:** modern autoloaded structure; reviewers generally accept it, but some prefer `class-*.php`.
* **One-minute cron schedule:** the delivery queue needs it; a real cron job is documented as the recommended alternative.
* **Uninstall keeps data by default:** the product requirements specify an explicit opt-in for deletion. If the reviewer insists on deletion by default, flip `privacy.delete_on_uninstall` to `true` in `Core/Settings::defaults()`.
