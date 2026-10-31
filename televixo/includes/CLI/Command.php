<?php
/**
 * WP-CLI commands.
 *
 * ## EXAMPLES
 *
 *     # Run the queue worker for 55 seconds (use from host cron every minute)
 *     wp televixo worker --seconds=55
 *
 *     # Supervised long-running worker
 *     wp televixo worker --loop
 *
 * @package Televixo
 */

namespace Televixo\CLI;

use Televixo\Privacy\Retention;
use Televixo\Queue\Outbox;
use Televixo\Queue\Scheduler;
use Televixo\Queue\Worker;
use Televixo\Security\Secrets;

defined( 'ABSPATH' ) || exit;

final class Command {

	/**
	 * Processes inbound updates and outbox jobs.
	 *
	 * ## OPTIONS
	 *
	 * [--seconds=<seconds>]
	 * : Time budget per run. Default 55.
	 *
	 * [--loop]
	 * : Keep running, sleeping briefly when idle (for a process supervisor).
	 *
	 * @param string[]             $args
	 * @param array<string,string> $assoc
	 */
	public function worker( array $args, array $assoc ): void {
		$seconds = max( 1, min( 600, (int) ( $assoc['seconds'] ?? 55 ) ) );
		do {
			$stats = Worker::run( (float) $seconds );
			\WP_CLI::log( sprintf( 'inbound=%d outbox=%d %s', $stats['inbound'], $stats['outbox'], wp_json_encode( $stats['results'] ) ) );
			if ( isset( $assoc['loop'] ) && 0 === $stats['outbox'] + $stats['inbound'] ) {
				sleep( 2 );
			}
		} while ( isset( $assoc['loop'] ) );
	}

	/**
	 * Shows queue health, lists jobs, or retries a job.
	 *
	 * ## OPTIONS
	 *
	 * <action>
	 * : status | list | retry
	 *
	 * [<id>]
	 * : Job ID for retry.
	 *
	 * [--status=<status>]
	 * : For list: pending, dead, uncertain, done. Default dead.
	 *
	 * @param string[]             $args
	 * @param array<string,string> $assoc
	 */
	public function queue( array $args, array $assoc ): void {
		switch ( $args[0] ?? 'status' ) {
			case 'list':
				global $wpdb;
				$rows = \Televixo\Persistence\Db::rows( \Televixo\Persistence\Db::prepare( 'SELECT id, job_type, conversation_id, status, attempts, last_error_code, updated_at FROM {outbox} WHERE status = %s ORDER BY id DESC LIMIT 50', $assoc['status'] ?? 'dead' ) );
				\WP_CLI\Utils\format_items( 'table', $rows, array( 'id', 'job_type', 'conversation_id', 'status', 'attempts', 'last_error_code', 'updated_at' ) );
				return;
			case 'retry':
				$ok = Outbox::manual_retry( (int) ( $args[1] ?? 0 ) );
				$ok ? \WP_CLI::success( 'Job requeued.' ) : \WP_CLI::error( 'Only dead or uncertain jobs can be retried.' );
				return;
			default:
				\WP_CLI::log( (string) wp_json_encode( Scheduler::health(), JSON_PRETTY_PRINT ) );
		}
	}

	/**
	 * Runs retention cleanup now.
	 */
	public function maintenance(): void {
		\WP_CLI::log( (string) wp_json_encode( Retention::run() ) );
	}

	/**
	 * Secret management.
	 *
	 * ## OPTIONS
	 *
	 * <action>
	 * : rotate | status
	 *
	 * @param string[] $args
	 */
	public function secrets( array $args ): void {
		if ( 'rotate' === ( $args[0] ?? '' ) ) {
			\WP_CLI::success( sprintf( 'Re-encrypted %d secrets with the current key.', Secrets::rotate() ) );
			return;
		}
		\WP_CLI::log( 'Key source: ' . Secrets::key_source() );
		$bad = Secrets::undecryptable();
		$bad ? \WP_CLI::warning( 'Cannot decrypt: ' . implode( ', ', $bad ) . '. Re-enter them in setup or set TELEVIXO_ENCRYPTION_KEY_PREVIOUS.' ) : \WP_CLI::success( 'All secrets readable.' );
	}
}
