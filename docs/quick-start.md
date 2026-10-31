# Quick start

1. **Check hosting:** PHP 8.2+, WordPress 6.7+, MySQL 5.7+/MariaDB 10.4+ (utf8mb4), HTTPS. See `hosting-requirements.md`.
2. **Install:** Plugins → Add New → Upload Plugin → `televixo.zip` → Activate.
3. **Create a bot:** in Telegram, open @BotFather → `/newbot` → copy the token. Use a bot dedicated to this website.
4. **Connect:** Televixo → Setup → paste the token → *Test & save*.
5. **Destination:** create a Telegram group for your team, add the bot, send any message in the group. Back in Setup the group appears under *Chats the bot has seen recently* (after step 6) — or enter its ID (`-100…`). Choose **Reply Mode** (works with any group) or **Topics Mode** (supergroup with Topics enabled, bot as admin with *Manage topics*) → *Check & save*.
   > Everyone in the group can read relayed messages. Use one group per team, or the WordPress inbox, when isolation matters.
6. **Webhook:** *Register webhook*. If the bot already points elsewhere, you are asked before it is replaced.
7. **Test:** *Send test message*. Then open your site, click the launcher and send a message.
8. **Link operators:** each operator opens a private chat with the bot, presses **Start**, then sends `/link CODE` using a code from Televixo → Operators & teams (valid 10 minutes, single use).
9. **Reply:** in Reply Mode, use Telegram's *Reply* on the visitor message. In Topics Mode, write inside the conversation's topic. Lines starting with `#note` become internal notes. Commands: `/claim`, `/close`, `/note …`, `/spam`, `/online`, `/away`.
10. **Cron (recommended):** `* * * * * cd /path/to/wordpress && wp televixo worker --seconds=55 --quiet` (see `cron.md`).
