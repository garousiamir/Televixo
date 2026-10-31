<?php
/**
 * Durable outbox with leases.
 *
 * Statuses: pending → leased → done | pending (retry) | uncertain | dead | cancelled.
 *
 * Ordering: a job is only claimable when no earlier job with the same
 * ordering_key is pending or leased, which preserves per-conversation order.
 * Jobs in `uncertain` do not block later jobs (see docs/delivery.md).
 *
 * Leases: a claim stamps a random lease token and expiry. A crashed worker's
 * job becomes claimable again once the lease expires. Completion is
 * conditional on the lease token, so a slow worker whose lease was taken over
 * cannot overwrite the new owner's result.
 *
 * @package Televixo
 */

namespace Televixo\Queue;

use Televixo\Core\Clock;
use Televixo\Persistence\Db;
use Televixo\Security\Random;
use Televixo\Security\Redactor;

defined( 'ABSPATH' ) || exit;

final class Outbox {

	public const LEASE_SECONDS = 60;
	public const BASE_DELAY    = 5;
	public const MAX_DELAY     = 3600;

	/**
	 * @param array<string,mixed> $payload
	 */
	public static function enqueue( string $type, string $ordering_key, array $payload, ?int $conversation_id = null, ?int $message_id = null, int $delay = 0, int $max_attempts = 8 ): int {
		$now = Clock::mysql();
		return Db::insert(
			'outbox',
			array(
				'job_type'        => $type,
				'ordering_key'    => $ordering_key,
				'conversation_id' => $conversation_id,
				'message_id'      => $message_id,
				'payload'         => wp_json_encode( $payload ),
				'status'          => 'pending',
				'max_attempts'    => $max_attempts,
				'available_at'    => Clock::mysql( Clock::now() + $delay ),
				'created_at'      => $now,
				'updated_at'      => $now,
			)
		);
	}

	/**
	 * Claims up to $limit ready jobs.
	 *
	 * @return array<int,array<string,mixed>>
	 */
	public static function claim( int $limit = 10, int $lease_seconds = self::LEASE_SECONDS ): array {
		$now        = Clock::mysql();
		$candidates = Db::rows(
			Db::prepare(
				"SELECT o.id FROM {outbox} o
				WHERE ( (o.status = 'pending' AND o.available_at <= %s) OR (o.status = 'leased' AND o.lease_expires_at < %s) )
				AND NOT EXISTS (
					SELECT 1 FROM {outbox} p
					WHERE p.ordering_key = o.ordering_key AND o.ordering_key <> '' AND p.id < o.id
					AND p.status IN ('pending','leased')
				)
				ORDER BY o.available_at ASC, o.id ASC
				LIMIT %d",
				$now,
				$now,
				$limit * 3
			)
		);
		$claimed    = array();
		$keys       = array();
		foreach ( $candidates as $c ) {
			if ( count( $claimed ) >= $limit ) {
				break;
			}
			$token = Random::hex( 16 );
			$n     = Db::exec(
				Db::prepare(
					"UPDATE {outbox} SET status = 'leased', lease_token = %s, lease_expires_at = %s, attempts = attempts + 1, updated_at = %s
					WHERE id = %d AND ( (status = 'pending' AND available_at <= %s) OR (status = 'leased' AND lease_expires_at < %s) )",
					$token,
					Clock::mysql( Clock::now() + $lease_seconds ),
					$now,
					(int) $c['id'],
					$now,
					$now
				)
			);
			if ( 1 === $n ) {
				$job = self::get( (int) $c['id'] );
				if ( $job ) {
					// One job per ordering key per batch keeps order across retries.
					if ( '' !== $job['ordering_key'] && isset( $keys[ $job['ordering_key'] ] ) ) {
						self::release( $job );
						continue;
					}
					$keys[ $job['ordering_key'] ] = true;
					$claimed[]                    = $job;
				}
			}
		}
		return $claimed;
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function get( int $id ): ?array {
		return Db::row( Db::prepare( 'SELECT * FROM {outbox} WHERE id = %d', $id ) );
	}

	/**
	 * @return array<string,mixed>
	 */
	public static function payload( array $job ): array {
		$p = json_decode( (string) $job['payload'], true );
		return is_array( $p ) ? $p : array();
	}

	/**
	 * @return array<string,mixed>
	 */
	public static function progress( array $job ): array {
		$p = json_decode( (string) ( $job['progress'] ?? '' ), true );
		return is_array( $p ) ? $p : array();
	}

	/**
	 * Persists partial progress while still holding the lease.
	 *
	 * @param array<string,mixed> $progress
	 */
	public static function save_progress( array $job, array $progress ): bool {
		return 1 === Db::exec(
			Db::prepare(
				'UPDATE {outbox} SET progress = %s, lease_expires_at = %s, updated_at = %s WHERE id = %d AND lease_token = %s',
				wp_json_encode( $progress ),
				Clock::mysql( Clock::now() + self::LEASE_SECONDS ),
				Clock::mysql(),
				(int) $job['id'],
				(string) $job['lease_token']
			)
		);
	}

	public static function complete( array $job ): bool {
		return self::finish( $job, 'done', '', '' );
	}

	/**
	 * Schedules a retry with bounded exponential backoff and full jitter, or
	 * honours a provider retry hint (HTTP 429 retry_after). Moves to `dead`
	 * after max_attempts.
	 */
	public static function retry_later( array $job, string $code, string $error, ?int $retry_after = null ): string {
		if ( (int) $job['attempts'] >= (int) $job['max_attempts'] ) {
			self::finish( $job, 'dead', $code, $error );
			return 'dead';
		}
		$delay = null !== $retry_after ? max( 1, $retry_after ) + random_int( 0, 2 ) : self::backoff( (int) $job['attempts'] );
		Db::exec(
			Db::prepare(
				"UPDATE {outbox} SET status = 'pending', lease_token = '', lease_expires_at = NULL, available_at = %s, last_error_code = %s, last_error = %s, updated_at = %s WHERE id = %d AND lease_token = %s",
				Clock::mysql( Clock::now() + $delay ),
				substr( $code, 0, 64 ),
				Redactor::text( substr( $error, 0, 255 ) ),
				Clock::mysql(),
				(int) $job['id'],
				(string) $job['lease_token']
			)
		);
		return 'pending';
	}

	public static function backoff( int $attempts ): int {
		$cap = min( self::MAX_DELAY, self::BASE_DELAY * ( 2 ** max( 0, $attempts - 1 ) ) );
		return random_int( (int) ceil( $cap / 2 ), (int) $cap );
	}

	public static function fail( array $job, string $code, string $error ): bool {
		return self::finish( $job, 'dead', $code, $error );
	}

	public static function mark_uncertain( array $job, string $code, string $error ): bool {
		return self::finish( $job, 'uncertain', $code, $error );
	}

	public static function release( array $job ): void {
		Db::exec(
			Db::prepare(
				"UPDATE {outbox} SET status = 'pending', lease_token = '', lease_expires_at = NULL, attempts = GREATEST(attempts - 1, 0) WHERE id = %d AND lease_token = %s",
				(int) $job['id'],
				(string) $job['lease_token']
			)
		);
	}

	private static function finish( array $job, string $status, string $code, string $error ): bool {
		return 1 === Db::exec(
			Db::prepare(
				"UPDATE {outbox} SET status = %s, lease_token = '', lease_expires_at = NULL, last_error_code = %s, last_error = %s, updated_at = %s, completed_at = %s WHERE id = %d AND lease_token = %s",
				$status,
				substr( $code, 0, 64 ),
				Redactor::text( substr( $error, 0, 255 ) ),
				Clock::mysql(),
				Clock::mysql(),
				(int) $job['id'],
				(string) $job['lease_token']
			)
		);
	}

	/**
	 * Manual retry of a dead or uncertain job from the admin queue screen.
	 */
	public static function manual_retry( int $id ): bool {
		return 1 === Db::exec(
			Db::prepare(
				"UPDATE {outbox} SET status = 'pending', attempts = 0, available_at = %s, lease_token = '', lease_expires_at = NULL, completed_at = NULL, updated_at = %s WHERE id = %d AND status IN ('dead','uncertain')",
				Clock::mysql(),
				Clock::mysql(),
				$id
			)
		);
	}

	public static function discard( int $id ): bool {
		return 1 === Db::exec(
			Db::prepare(
				"UPDATE {outbox} SET status = 'cancelled', updated_at = %s, completed_at = %s WHERE id = %d AND status IN ('dead','uncertain','pending')",
				Clock::mysql(),
				Clock::mysql(),
				$id
			)
		);
	}

	/**
	 * @return array<string,int>
	 */
	public static function counts(): array {
		$rows = Db::rows( Db::prepare( 'SELECT status, COUNT(*) AS n FROM {outbox} GROUP BY status' ) );
		$out  = array(
			'pending'   => 0,
			'leased'    => 0,
			'done'      => 0,
			'dead'      => 0,
			'uncertain' => 0,
			'cancelled' => 0,
		);
		foreach ( $rows as $r ) {
			$out[ (string) $r['status'] ] = (int) $r['n'];
		}
		return $out;
	}

	public static function oldest_pending_age(): int {
		$oldest = Db::var( Db::prepare( "SELECT MIN(available_at) FROM {outbox} WHERE status IN ('pending','leased')" ) );
		$ts     = Clock::to_ts( $oldest ? (string) $oldest : null );
		return $ts ? max( 0, Clock::now() - $ts ) : 0;
	}

	public static function purge(): int {
		return Db::exec(
			Db::prepare(
				"DELETE FROM {outbox} WHERE (status IN ('done','cancelled') AND completed_at < %s) OR (status = 'dead' AND completed_at < %s)",
				Clock::mysql( Clock::now() - WEEK_IN_SECONDS ),
				Clock::mysql( Clock::now() - 30 * DAY_IN_SECONDS )
			)
		);
	}
}
