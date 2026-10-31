# Televixo – Telegram Live Chat for WordPress

By [pdthemes](https://pdthemes.de).

Self-hosted live chat for WordPress. Visitors chat on your website without a Telegram account; operators answer in Telegram (Reply Mode or Topics Mode) or in the WordPress inbox. WordPress is the source of truth for conversations, messages, permissions, routing and delivery status.

* Plugin source: [`televixo/`](televixo/) (installable directory)
* Widget & admin sources: [`assets-src/`](assets-src/) (TypeScript/React, built with esbuild)
* Tests: [`tests/`](tests/) — PHPUnit (WordPress test suite), JS, browser E2E, concurrency, visual
* Documentation: [`docs/`](docs/) — start with [`quick-start.md`](docs/quick-start.md) and [`implementation-status.md`](docs/implementation-status.md)
* Design reference supplied for the widget: [`refrence-html/`](refrence-html/) (not redistributed)

## Requirements

PHP 8.2+, WordPress 6.7+, MySQL 5.7+/MariaDB 10.4+ (utf8mb4), HTTPS for the Telegram webhook. No Node, Redis or WebSocket server at runtime. Details: [`docs/capabilities.md`](docs/capabilities.md).

## Build

```bash
npm ci
npm run build
```

```bash
composer install
```

```bash
php bin/package.php
```

Outputs `dist/televixo.zip` (installable) and `dist/televixo-full-<version>.zip` (zip + documentation + sources).

## Test

```bash
WP_CORE_DIR=/path/to/wordpress vendor/bin/phpunit
```

```bash
npm run test:js
```

```bash
vendor/bin/phpcs
```

Browser E2E, concurrency and visual harnesses need a throwaway WordPress site; see the headers of `tests/e2e/run.mjs`, `tests/concurrency/run.sh` and `tests/visual/compare.mjs`.

## License

GPL-2.0-or-later. Bundled fonts: SIL OFL 1.1 (see [`docs/sbom.md`](docs/sbom.md)).
