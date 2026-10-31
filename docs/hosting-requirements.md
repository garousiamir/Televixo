# Hosting requirements

* PHP **8.2+** with `sodium`, `json`, `mbstring`, `fileinfo`; `curl`/`openssl` for HTTPS; `zip` recommended.
* WordPress **6.7+** (tested 7.1.4).
* MySQL **5.7+** or MariaDB **10.4+**, InnoDB, `utf8mb4` (vendor-supported: MySQL 8.4 LTS+, MariaDB 10.11+).
* **HTTPS** with a valid certificate (required by Telegram webhooks).
* Outbound HTTPS to `api.telegram.org:443`; inbound POST from Telegram to `/wp-json/televixo/v1/telegram/webhook`. Do not put the webhook behind a login, WAF challenge or cache.
* A cron job every minute (strongly recommended; `cron.md`).
* PHP-FPM or LiteSpeed lets Televixo process messages right after the response; other SAPIs use a loopback request (must not be blocked by the host).
* Writable `wp-content/uploads` for private attachments. On **Nginx**, add `location ~* /wp-content/uploads/televixo-private-[a-f0-9]+/ { deny all; }` or set `define( 'TELEVIXO_STORAGE_DIR', '/path/outside/webroot' );`. Diagnostics test this.
* Page/CDN caching: exclude `/wp-json/televixo/*` (responses already send `no-store`). Page HTML is cache-safe.
* No Node.js, Redis or WebSocket server is needed on the host.
