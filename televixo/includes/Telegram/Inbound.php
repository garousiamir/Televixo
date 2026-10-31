<?php
/**
 * Durable inbound update log. Updates are stored (deduplicated on
 * provider+bot+update_id) before the webhook is acknowledged and processed
 * later under a lease, so crashes and Telegram redeliveries are safe.
 *
 * @package Televixo
 */

namespace Televixo\Telegram;

use Televixo\Core\Clock;
use Televixo\Persistence\Db;
use Televixo\Provider\Registry;
use Televixo\Security\Random;

defined( 'ABSPATH' ) || exit;

final class Inbound {

	public const LEASE = 60;
	public const MAX_ATTEMPTS = 5;

	/**
	 * @param array<string,mixed> $update
	 * @return bool True when newly stored, false for a duplicate.
	 */
	public static function store( string $account, array $update ): bool {
		$id = Db::insert_ignore_duplicate(
			'inbound_updates',
			array(
				'provider'    => 'telegram',
				'account_id'  => $account,
				'update_id'   => (string) $update['update_id'],
				'payload'     => wp_json_encode( $update ),
				'status'      => 'received',
				'received_at' => Clock::mysql(),
			)
		);
		return $id > 0;
	}

	/**
	 * Claims and processes stored updates in update_id order.
	 */
	public static function process_batch( int $limit, float $deadline ): int {
		$now  = Clock::mysql();
		$rows = Db::rows(
			Db::prepare(
				"SELECT id FROM {inbound_updates}
				WHERE (status = 'received' AND (lease_expires_at IS NULL OR lease_expires_at < %s)) OR (status = 'processing' AND lease_expires_at < %s)
				ORDER BY CAST(update_id AS UNSIGNED) ASC, id ASC LIMIT %d",
				$now,
				$now,
				$limit
			)
		);
		$done     = 0;
		$provider = Registry::get( 'telegram' );
		foreach ( $rows as $r ) {
			if ( microtime( true ) > $deadline || ! $provider ) {
				break;
			}
			$token = Random::hex( 16 );
			$n     = Db::exec(
				Db::prepare(
					"UPDATE {inbound_updates} SET status = 'processing', lease_token = %s, lease_expires_at = %s, attempts = attempts + 1
					WHERE id = %d AND ((status = 'received' AND (lease_expires_at IS NULL OR lease_expires_at < %s)) OR (status = 'processing' AND lease_expires_at < %s))",
					$token,
					Clock::mysql( Clock::now() + self::LEASE ),
					(int) $r['id'],
					$now,
					$now
				)
			);
			if ( 1 !== $n ) {
				continue;
			}
			$row     = Db::row( Db::prepare( 'SELECT * FROM {inbound_updates} WHERE id = %d', (int) $r['id'] ) );
			$payload = json_decode( (string) $row['payload'], true, 64, JSON_BIGINT_AS_STRING );
			try {
				$result = $provider->process_inbound( is_array( $payload ) ? $payload : array(), (int) $row['attempts'] );
			} catch ( \Throwable $e ) {
				$result = 'error:' . substr( get_class( $e ), -40 );
			}
			if ( 'defer' === $result && (int) $row['attempts'] < self::MAX_ATTEMPTS ) {
				// Reply target not mapped yet (out-of-order arrival): retry shortly.
				Db::exec( Db::prepare( "UPDATE {inbound_updates} SET status = 'received', lease_token = '', lease_expires_at = %s, result_code = 'deferred' WHERE id = %d AND lease_token = %s", Clock::mysql( Clock::now() + 5 * (int) $row['attempts'] ), (int) $row['id'], $token ) );
				continue;
			}
			$status = str_starts_with( $result, 'error:' ) ? ( (int) $row['attempts'] < self::MAX_ATTEMPTS ? 'received' : 'failed' ) : ( str_starts_with( $result, 'ignored' ) ? 'ignored' : 'processed' );
			$lease_sql = 'received' === $status ? Db::prepare( '%s', Clock::mysql( Clock::now() + 10 ) ) : 'NULL';
			Db::exec(
				Db::prepare(
					"UPDATE {inbound_updates} SET status = %s, lease_token = '', lease_expires_at = $lease_sql, result_code = %s, processed_at = %s WHERE id = %d AND lease_token = %s",
					$status,
					substr( $result, 0, 64 ),
					Clock::mysql(),
					(int) $row['id'],
					$token
				)
			);
			++$done;
		}
		return $done;
	}

	public static function pending_count(): int {
		return (int) Db::var( Db::prepare( "SELECT COUNT(*) FROM {inbound_updates} WHERE status IN ('received','processing')" ) );
	}

	public static function purge(): int {
		return Db::exec( Db::prepare( "DELETE FROM {inbound_updates} WHERE status IN ('processed','ignored','failed') AND received_at < %s", Clock::mysql( Clock::now() - 14 * DAY_IN_SECONDS ) ) );
	}
}
