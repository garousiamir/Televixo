# Known limitations

* **No real Telegram verification yet.** Every Telegram behaviour was tested against a fake Bot API built from Telegram's server source. Run the real-provider checklist (below) with a test bot before release.
* **Exactly-once delivery is impossible** with the Bot API. Timeouts are held as *uncertain*; a crash after Telegram accepted a part but before it was recorded can duplicate that part on retry.
* **Telegram presence, read receipts and typing are not available**; operator online status comes only from explicit availability.
* **Group visibility:** everyone in a destination group sees relayed messages; use per-team groups for isolation.
* **Voice notes** require browsers that record OGG/Opus (Firefox) or M4A (Safari). Chromium records only WebM, so the microphone button is hidden there; visitors can attach audio files instead.
* **Edits and deletions** of operator messages in Telegram are not synchronized to the website.
* **SPA navigation:** page facts (post type, terms, WooCommerce page) come from the initial page load unless the site calls `televixo.updatePage()`.
* **Untested platforms:** PHP 8.2/8.4/8.5, MySQL, WooCommerce, multisite network activation, page builders, Safari/Firefox, real screen readers.
* **Persian translation** covers visitor-facing strings (132); admin screens are in English. WordPress core has no Persian pack in the test environment, so RTL was forced in E2E.
* **Visual sign-off** pending; the reference covers only the chat panel.
* **No licensing/update server** is included (none was specified); updates are manual uploads.
* Admin translator comments are lost in the minified JS bundle (`wp i18n make-pot` warns); strings remain translatable.

## Real-provider checklist (to run with a test bot)

1. `getMe` with the token; Reply Mode in a normal group with privacy mode on: visitor message → reply → visitor receives.
2. Reply to the 2nd chunk of a 9 000-character message.
3. Topics Mode: topic created, plain topic message delivered, `#note` stays internal, close → topic closed, delete topic → recreated.
4. Anonymous admin reply rejected with feedback; non-enrolled member reply rejected.
5. Photo/document/voice both directions.
6. Remove the bot from the group → `bot_removed` health flag; upgrade a basic group to a supergroup → migration.
7. `setWebhook` with secret, `getWebhookInfo` last error display, `deleteWebhook` ownership check.
