=== Televixo – Telegram Live Chat for WordPress ===
Contributors: pdthemes
Tags: live chat, telegram, support, chat widget, customer service
Requires at least: 6.7
Tested up to: 7.1
Requires PHP: 8.2
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Self-hosted live chat: visitors chat on your site without a Telegram account; your team answers in Telegram or in the WordPress inbox.

== Description ==

Televixo adds a chat widget to your site. Conversations, messages, files, routing and delivery status are stored in your WordPress database. Visitor messages are relayed to a Telegram group (or a private chat) through your own bot, and operators reply from Telegram or from the inbox in WordPress.

* Reply Mode (operators reply to the bot's message) and Topics Mode (one forum topic per conversation).
* Operators are enrolled individually; replies from unknown or anonymous senders are never delivered.
* Durable delivery queue with retries, rate-limit handling and dead-letter inspection.
* Inbox with assignment, transfers, teams, round-robin and least-busy routing, internal notes, tags and canned replies.
* Pre-chat and offline forms, business hours, holidays, files, voice notes (where the browser supports Telegram voice formats), CSAT and transcripts.
* Visual targeting rules (page, URL, WooCommerce, behaviour, UTM, schedule) with frequency caps.
* Reports, privacy exporters/erasers, retention and redacted diagnostics.
* No external services besides the Telegram Bot API. No telemetry, no external fonts.

== Installation ==

1. Upload televixo.zip in Plugins → Add New → Upload Plugin and activate.
2. Open Televixo → Setup, paste the bot token from @BotFather, choose the destination chat and register the webhook (HTTPS required).
3. Link operators' Telegram accounts with one-time codes (Televixo → Operators & teams).
4. Recommended: run the queue from a real cron job: `* * * * * wp televixo worker --seconds=55`.

Full documentation is in the documentation folder of the download package. Support and updates: https://pdthemes.de

== Frequently Asked Questions ==

= Do visitors need Telegram? =
No. Visitors use the website widget. Only operators use Telegram.

= Who can see relayed messages? =
Everyone in the destination Telegram group. Use separate groups per team, or the WordPress inbox, when conversations must stay private between teams.

= Does Telegram show if an operator is online or has read a message? =
No. Televixo shows "online" only when an operator set themselves available (inbox heartbeat or /online in Telegram). "Delivered to the team" means Telegram accepted the message, not that a person read it.

== Privacy ==

Visitor messages, files and the context you choose (name, page path, etc.) are sent to Telegram. Copies in Telegram are not deleted when you delete a conversation in WordPress. Televixo sets one HttpOnly session cookie (televixo_session) and may store non-identifying preferences in the visitor's browser (first-visit flag, drafts, prompt history). Suggested privacy policy text is added under Settings → Privacy.

== Changelog ==

= 1.0.0 =
* Initial release.
