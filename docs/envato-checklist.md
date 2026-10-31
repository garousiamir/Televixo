# Envato (CodeCanyon) WordPress plugin checklist

**Status of this document:** the official requirements page (`https://help.author.envato.com/hc/en-us/articles/360000510603-WordPress-Plugin-Requirements`) could not be fetched from the build environment (network policy). The items below follow Envato's long-standing published WordPress requirements as known at release time and **must be re-checked against the current page before submission**. Passing this list does not guarantee approval.

| Requirement | Status | Notes |
|---|---|---|
| GPL-compatible license for PHP/JS/CSS; third-party licenses documented | ✅ | GPL-2.0-or-later; fonts OFL-1.1 (`sbom.md`) |
| Unique prefix for functions, classes, options, hooks, handles, DB tables, cookies, CSS | ✅ | `Televixo\` namespace, `televixo_` options/hooks/tables, `tvx-` CSS inside Shadow DOM, `.tvxa` admin scope |
| Scripts/styles via `wp_enqueue_*`; admin assets only on plugin screens | ✅ | `Admin::assets()` checks hook suffixes; front end one deferred script |
| No bundled copies of WordPress-provided libraries | ✅ | React/`wp.*` externalized |
| Data validated, sanitized on input and escaped on output | ✅ (code review) | `Settings::sanitize`, REST validation, `esc_*` in PHP output; widget uses `textContent` |
| Nonces/CSRF and capability checks on every privileged action | ✅ | REST `permission_callback` everywhere; tests |
| Prepared SQL | ✅ | `$wpdb->prepare` via `Db::prepare` |
| No `eval`, obfuscation, encoded payloads, remote code | ✅ | plural expressions parsed without `eval` |
| WordPress HTTP API for remote requests | ✅ | `wp_remote_post/get` |
| No unexpected external requests, tracking or "phone home"; no external fonts/CDNs | ✅ | only `api.telegram.org` after admin setup; local fonts |
| Translation ready, text domain matches slug, POT included | ✅ | `languages/televixo.pot`, `televixo-fa_IR.po/.mo` |
| No PHP notices/warnings with `WP_DEBUG` | ✅ (tested paths) | E2E site ran with `WP_DEBUG_LOG`; only core update-check warnings caused by the offline network |
| Uninstall cleans up only on explicit opt-in; deactivation keeps data | ✅ | `uninstall.php` + tests |
| Settings import/export without secrets | ✅ | |
| Documentation included (install, usage, FAQ, changelog) | ✅ | `documentation/` in full archive |
| Plugin header complete (Requires PHP / Requires at least / Text Domain / License) | ✅ | `televixo.php`, `readme.txt` |
| Minimum supported PHP/WP stated and enforced gracefully | ✅ | `capabilities.md` |
| Coding standards (WordPress Coding Standards) | ⚠️ | See PHPCS run in `implementation-status.md`; minified admin JS loses translator comments |
| Admin UI consistency / no intrusive notices | ✅ | single setup notice off plugin screens; error notice only for broken delivery |
| No purchase-code locking or hidden licensing | ✅ | none included |
| Item preview / screenshots | ⚠️ | `docs/screenshots/` from the test site; marketing assets not produced |
