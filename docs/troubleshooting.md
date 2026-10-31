# Troubleshooting

| Symptom | Check |
|---|---|
| Setup: "Telegram rejected this token" | Copy the full token from @BotFather (`123456:ABC…`). Revoked tokens must be regenerated. |
| Setup: "Could not reach Telegram" | The server must reach `api.telegram.org:443`. Ask your host to allow outbound HTTPS. |
| "Telegram webhooks require HTTPS" | Enable HTTPS (valid certificate) and make sure WordPress Address uses `https://`. |
| Webhook registered to another host | The bot is used by another site/service. Use a dedicated bot or confirm replacement. |
| Visitor messages not appearing in Telegram | Delivery & health → Failed: `bot_removed` (add the bot back), `chat_not_found` (wrong ID / migrated), `missing_permission` (Topics: make the bot admin with Manage topics). `worker_stale` → set up cron. |
| Operator replies not reaching visitors | Operator linked? (Operators & teams). In Reply Mode they must *Reply* to a bot message. Anonymous admin mode off. The bot answers with the reason for rejected replies. Webhook last error (Setup step 3). |
| Topics: messages typed in topics ignored | The bot must be an admin (or privacy mode disabled in @BotFather) to receive non-reply messages. |
| Widget never shows "online" | An operator must set *Available* in the inbox (heartbeat) or send `/online` to the bot. Business hours/away may override. |
| Widget missing on a page | Excluded paths, targeting rules hiding the launcher, offline behaviour "Hide", or a theme without `wp_footer()`. |
| "Your chat session has expired" | Session cookie blocked (privacy extensions) or caching plugin stripping cookies on `/wp-json/televixo/*`. |
| Attachments publicly reachable warning | Add the Nginx rule from Delivery & health or set `TELEVIXO_STORAGE_DIR`. |
| "Some secrets can no longer be decrypted" | WordPress salts changed. Re-enter the token, or set `TELEVIXO_ENCRYPTION_KEY_PREVIOUS` and run `wp televixo secrets rotate`. |
| Uncertain deliveries | A timeout hit after sending. Check the Telegram chat; retry only if the message is missing. |

Diagnostics (Delivery & health) are redacted and safe to share with support.
