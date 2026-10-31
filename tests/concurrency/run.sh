#!/bin/sh
# Multi-process race tests against a real MariaDB (separate connections).
set -e
WP="${WP_CLI:-/tmp/claude-0/bin/wp} --path=${WP_PATH:-/tmp/claude-0/env/site}"
D=$(dirname "$0")
$WP eval-file "$D/prepare.php"
$WP option update tvx_e2e_latency 150 >/dev/null
GO=$(php -r 'echo microtime(true) + 3;')
$WP option update tvx_race_go "$GO" >/dev/null
for i in 0 1 2 3 4 5 6 7 8 9; do $WP eval-file "$D/claim.php" $i > /tmp/claude-0/claim-$i.out & done
for w in 1 2 3 4; do $WP eval-file "$D/work.php" > /tmp/claude-0/work-$w.out & done
wait
$WP option update tvx_e2e_latency 0 >/dev/null
echo "claims: $(cat /tmp/claude-0/claim-*.out | sort | uniq -c | tr '\n' ' ')"
echo "workers: $(cat /tmp/claude-0/work-*.out | tr '\n' ' ')"
$WP eval-file "$D/verify.php"

# Crash recovery: kill -9 a worker mid-batch, expire leases, recover.
$WP eval-file "$D/prepare.php" >/dev/null
$WP option update tvx_e2e_latency 400 >/dev/null
$WP option update tvx_race_go 0 >/dev/null
$WP eval-file "$D/work.php" > /dev/null 2>&1 &
PID=$!
sleep 2
pkill -9 -P $PID 2>/dev/null || true; kill -9 $PID 2>/dev/null || true
wait $PID 2>/dev/null || true
$WP option update tvx_e2e_latency 0 >/dev/null
LEASED=$($WP eval 'echo (int) \Televixo\Persistence\Db::var( \Televixo\Persistence\Db::prepare( "SELECT COUNT(*) FROM {outbox} WHERE status = %s", "leased" ) );')
$WP eval '\Televixo\Persistence\Db::exec( \Televixo\Persistence\Db::prepare( "UPDATE {outbox} SET lease_expires_at = %s WHERE status = %s", gmdate( "Y-m-d H:i:s", time() - 1 ), "leased" ) );'
$WP eval-file "$D/work.php" >/dev/null
echo "crash: leased_after_kill=$LEASED $($WP eval-file "$D/verify.php")"
