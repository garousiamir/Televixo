# Background processing & cron

WP-Cron only runs when someone visits the site. On low-traffic sites, queued Telegram messages could wait until the next visit. Televixo mitigates this by processing right after each request that queues work (5-second budget), but a real cron job is recommended for reliability.

## Option A — WP-CLI (recommended)

```bash
* * * * * cd /path/to/wordpress && wp televixo worker --seconds=55 --quiet
```

## Option B — HTTP cron

Add `define( 'DISABLE_WP_CRON', true );` to `wp-config.php` and request `wp-cron.php` every minute:

```bash
* * * * * curl -s https://example.com/wp-cron.php?doing_wp_cron > /dev/null
```

## Option C — supervised long-running worker

```bash
wp televixo worker --loop
```

Run under systemd/supervisord with automatic restart.

## Health warnings

Delivery & health (and `wp televixo queue status`) show:

* `worker_stale` — no worker run in 10 minutes;
* `queue_backlog` — oldest pending job older than 5 minutes;
* `wp_cron_disabled_without_runner` — `DISABLE_WP_CRON` set but nothing is running the worker.

Daily maintenance (`televixo_maintenance`) applies retention and purges expired sessions, rate-limit windows, processed updates, finished jobs and orphaned uploads. Run it manually with `wp televixo maintenance`.
