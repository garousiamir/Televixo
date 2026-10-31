# Dependencies, licenses & attribution

## Shipped inside `televixo.zip`

| Component | Version | License | Use |
|---|---|---|---|
| Televixo code | 1.0.0 | GPL-2.0-or-later | plugin |
| Hanken Grotesk (via @fontsource/hanken-grotesk, latin + latin-ext 400/500 woff2) | 5.3.0 | SIL OFL 1.1 (`assets/build/fonts/OFL-HankenGrotesk.txt`) | widget font |
| Vazirmatn (via @fontsource/vazirmatn, Arabic 400/500 woff2) | 5.3.0 | SIL OFL 1.1 (`assets/build/fonts/OFL-Vazirmatn.txt`) | Persian/Arabic glyphs |
| Icons | — | original line icons drawn for Televixo (GPL-2.0-or-later) | widget/admin |

No PHP runtime dependencies (no Composer packages are shipped; PSR-4 autoloader is Televixo's own, namespaced `Televixo\`, so there are no class collisions). The admin uses React, `wp.element`, `wp.apiFetch` and `wp.i18n` **provided by WordPress core** (externalized at build time, not bundled).

## Build-time only (not shipped)

| Package | Version | License |
|---|---|---|
| esbuild | 0.25.12 | MIT |
| typescript | 5.8.3 | Apache-2.0 |
| @wordpress/element, api-fetch, i18n (types and externals) | 6.20.0 / 7.20.0 / 5.20.0 | GPL-2.0-or-later |
| @types/react | 18.3.12 | MIT |
| axe-core (tests) | 4.10.3 | MPL-2.0 |
| phpunit/phpunit | 9.6.38 | BSD-3-Clause |
| wp-phpunit/wp-phpunit | 7.1.3 | GPL-2.0-or-later |
| yoast/phpunit-polyfills | 4.0.0 | BSD-3-Clause |
| Playwright + Chromium (preinstalled in CI image) | — | Apache-2.0 |
| pixelmatch 5.3.0 / pngjs 7.0.0 (visual harness, installed ad hoc) | — | ISC / MIT |

Full transitive list: `package-lock.json`, `composer.lock`.

## Reference assets

The supplied HTML reference (`refrence-html/`) and its photos, product images and brand logos are **not** redistributed in the plugin or the distribution archive. Its design language (colours, radii, spacing) was reproduced in original CSS. The reference's demo copy ("Hi! I'm Clara…") appears only in local test fixtures. The reference avatar photo is used only by the local visual comparison harness; images derived from it (`docs/visual/`) are excluded from the distribution archive.
