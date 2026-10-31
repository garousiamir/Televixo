<?php
/**
 * Processes inbound updates and outbox jobs within a time budget.
 *
 * Entry points: the bounded post-response path (Scheduler::kick), WP-Cron
 * (`televixo_worker`, every minute when traffic or a real cron triggers
 * wp-cron.php) and `wp televixo worker` for host cron or a supervised loop.
 *
 * @package Televixo
 */

namespace Televixo\Queue;

use Televixo\Core\Clock;
use Televixo\Domain\DeliveryState;
use Televixo\Domain\Messages;
use Televixo\Provider\DeliveryResult;
use Televixo\Provider\Registry;
use Televixo\Telegram\Inbound;

defined( 'ABSPATH' ) || exit;

final class Worker {

	/**
	 * @return array{inbound:int,outbox:int,results:array<string,int>}
	 */
	public static function run( float $seconds = 20.0, int $max_jobs = 200 ): array {
		$deadline = microtime( true ) + $seconds;
		$stats    = array( 'inbound' => 0, 'outbox' => 0, 'results' => array() );
		update_option( 'televixo_worker_last_run', Clock::mysql(), false );

		while ( microtime( true ) < $deadline && $stats['outbox'] < $max_jobs ) {
			$in    = Inbound::process_batch( 20, $deadline );
			$jobs  = Outbox::claim( 10 );
			$stats['inbound'] += $in;
			if ( ! $jobs && 0 === $in ) {
				break;
			}
			foreach ( $jobs as $job ) {
				if ( microtime( true ) > $deadline ) {
					Outbox::release( $job );
					continue;
				}
				$result = self::process_job( $job );
				$stats['results'][ $result ] = ( $stats['results'][ $result ] ?? 0 ) + 1;
				++$stats['outbox'];
			}
		}
		return $stats;
	}

	public static function process_job( array $job ): string {
		$provider = Registry::for_job( (string) $job['job_type'] );
		if ( ! $provider ) {
			Outbox::fail( $job, 'no_provider', 'No provider handles this job type.' );
			return 'failed';
		}
		try {
			$result = $provider->process( $job );
		} catch ( \Throwable $e ) {
			$result = DeliveryResult::retry( 'exception', get_class( $e ) . ': ' . $e->getMessage() );
		}
		switch ( $result->status ) {
			case DeliveryResult::DONE:
				Outbox::complete( $job );
				return 'done';
			case DeliveryResult::UNCERTAIN:
				Outbox::mark_uncertain( $job, $result->code, $result->error );
				return 'uncertain';
			case DeliveryResult::RETRY:
				$state = Outbox::retry_later( $job, $result->code, $result->error, $result->retry_after );
				if ( 'dead' === $state && $job['message_id'] ) {
					Messages::set_delivery( (int) $job['message_id'], DeliveryState::Failed, $result->code );
				}
				return 'dead' === $state ? 'dead' : 'retry';
			default:
				Outbox::fail( $job, $result->code, $result->error );
				if ( $job['message_id'] ) {
					Messages::set_delivery( (int) $job['message_id'], DeliveryState::Failed, $result->code );
				}
				return 'failed';
		}
	}
}
