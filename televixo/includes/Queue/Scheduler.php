<?php
/**
 * Background scheduling.
 *
 * 1. Immediate, bounded path: after a request that queued work, the worker
 *    runs for at most IMMEDIATE_BUDGET seconds after the response has been
 *    flushed (fastcgi_finish_request / litespeed_finish_request). Without
 *    those, a non-blocking loopback request authenticated with a short-lived
 *    HMAC triggers the worker instead, so visitors never wait on Telegram.
 * 2. WP-Cron every minute (traffic-dependent; see docs/cron.md).
 * 3. Real cron / WP-CLI: `wp televixo worker --seconds=55` every minute.
 *
 * @package Televixo
 */

namespace Televixo\Queue;

use Televixo\Core\Clock;
use Televixo\Security\Secrets;

defined( 'ABSPATH' ) || exit;

final class Scheduler {

	public const HOOK_WORKER      = 'televixo_worker';
	public const HOOK_MAINTENANCE = 'televixo_maintenance';
	public const IMMEDIATE_BUDGET = 5.0;

	private static bool $kicked = false;

	public static function register(): void {
		add_filter( 'cron_schedules', array( self::class, 'schedules' ) ); // phpcs:ignore WordPress.WP.CronInterval.CronSchedulesInterval -- one-minute queue cadence is intentional.
		add_action( self::HOOK_WORKER, array( self::class, 'cron_worker' ) );
		add_action( self::HOOK_MAINTENANCE, array( '\Televixo\Privacy\Retention', 'run' ) );
		add_action( 'televixo_visitor_message_created', array( self::class, 'kick' ) );
		add_action( 'televixo_operator_message_created', array( self::class, 'kick' ) );
		add_action( 'televixo_inbound_stored', array( self::class, 'kick' ) );
	}

	/**
	 * @param array<string,array<string,mixed>> $s
	 * @return array<string,array<string,mixed>>
	 */
	public static function schedules( array $s ): array {
		$s['televixo_minute'] = array(
			'interval' => MINUTE_IN_SECONDS,
			'display'  => __( 'Every minute (Televixo queue)', 'televixo' ),
		);
		return $s;
	}

	public static function ensure_events(): void {
		if ( ! wp_next_scheduled( self::HOOK_WORKER ) ) {
			wp_schedule_event( time() + 30, 'televixo_minute', self::HOOK_WORKER );
		}
		if ( ! wp_next_scheduled( self::HOOK_MAINTENANCE ) ) {
			wp_schedule_event( time() + HOUR_IN_SECONDS, 'daily', self::HOOK_MAINTENANCE );
		}
	}

	public static function clear_events(): void {
		wp_clear_scheduled_hook( self::HOOK_WORKER );
		wp_clear_scheduled_hook( self::HOOK_MAINTENANCE );
	}

	public static function cron_worker(): void {
		Worker::run( 20.0 );
	}

	/**
	 * Schedules bounded processing at the end of this request.
	 */
	public static function kick(): void {
		if ( self::$kicked || ( defined( 'TELEVIXO_TESTING' ) && TELEVIXO_TESTING ) || ( defined( 'WP_CLI' ) && WP_CLI ) ) {
			return;
		}
		self::$kicked = true;
		if ( function_exists( 'fastcgi_finish_request' ) || function_exists( 'litespeed_finish_request' ) ) {
			add_action( 'shutdown', array( self::class, 'run_after_response' ), 1000 );
			return;
		}
		add_action( 'shutdown', array( self::class, 'loopback' ), 1000 );
	}

	public static function run_after_response(): void {
		if ( function_exists( 'fastcgi_finish_request' ) ) {
			fastcgi_finish_request();
		} elseif ( function_exists( 'litespeed_finish_request' ) ) {
			litespeed_finish_request();
		}
		ignore_user_abort( true );
		Worker::run( self::IMMEDIATE_BUDGET, 25 );
	}

	public static function loopback(): void {
		$ts  = Clock::now();
		$sig = self::signature( $ts );
		wp_remote_post(
			rest_url( 'televixo/v1/internal/worker' ),
			array(
				'timeout'   => 0.01,
				'blocking'  => false,
				'sslverify' => apply_filters( 'https_local_ssl_verify', false ), // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- core filter.
				'body'      => array( 'ts' => $ts, 'sig' => $sig ),
			)
		);
	}

	public static function signature( int $ts ): string {
		return hash_hmac( 'sha256', 'worker|' . $ts, Secrets::pepper() );
	}

	public static function verify( int $ts, string $sig ): bool {
		return abs( Clock::now() - $ts ) <= 60 && hash_equals( self::signature( $ts ), $sig );
	}

	/**
	 * @return array<string,mixed> Queue health for diagnostics.
	 */
	public static function health(): array {
		$last    = Clock::to_ts( (string) get_option( 'televixo_worker_last_run', '' ) );
		$age     = Outbox::oldest_pending_age();
		$warns   = array();
		if ( ! $last || Clock::now() - $last > 10 * MINUTE_IN_SECONDS ) {
			$warns[] = 'worker_stale';
		}
		if ( $age > 5 * MINUTE_IN_SECONDS ) {
			$warns[] = 'queue_backlog';
		}
		if ( defined( 'DISABLE_WP_CRON' ) && DISABLE_WP_CRON && ( ! $last || Clock::now() - $last > 5 * MINUTE_IN_SECONDS ) ) {
			$warns[] = 'wp_cron_disabled_without_runner';
		}
		return array(
			'last_run'           => $last ? gmdate( 'c', $last ) : null,
			'oldest_pending_age' => $age,
			'counts'             => Outbox::counts(),
			'inbound_pending'    => \Televixo\Telegram\Inbound::pending_count(),
			'next_cron'          => wp_next_scheduled( self::HOOK_WORKER ) ? gmdate( 'c', (int) wp_next_scheduled( self::HOOK_WORKER ) ) : null,
			'wp_cron_disabled'   => defined( 'DISABLE_WP_CRON' ) && DISABLE_WP_CRON,
			'warnings'           => $warns,
		);
	}
}
