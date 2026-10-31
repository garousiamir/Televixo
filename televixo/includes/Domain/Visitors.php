<?php
/**
 * Visitor profile updates and blocking.
 *
 * @package Televixo
 */

namespace Televixo\Domain;

use Televixo\Core\Clock;
use Televixo\Persistence\Db;
use Televixo\Security\SessionManager;

defined( 'ABSPATH' ) || exit;

final class Visitors {

	public const BLOCKED_NETWORKS = 'televixo_blocked_networks';

	/**
	 * @return array<string,mixed>|null
	 */
	public static function get( int $id ): ?array {
		return Db::row( Db::prepare( 'SELECT * FROM {visitors} WHERE id = %d', $id ) );
	}

	/**
	 * @param array<string,mixed> $fields Already validated.
	 */
	public static function update_profile( int $id, array $fields ): void {
		$data = array( 'updated_at' => Clock::mysql() );
		foreach ( array( 'name' => 190, 'email' => 190, 'phone' => 64 ) as $key => $len ) {
			if ( isset( $fields[ $key ] ) && '' !== $fields[ $key ] ) {
				$data[ $key ] = mb_substr( (string) $fields[ $key ], 0, $len );
			}
		}
		if ( ! empty( $fields['custom'] ) ) {
			$data['custom_fields'] = wp_json_encode( $fields['custom'] );
		}
		if ( ! empty( $fields['consent'] ) ) {
			$data['consent_at']   = Clock::mysql();
			$data['consent_hash'] = hash( 'sha256', (string) ( $fields['consent_text'] ?? '' ) );
		}
		Db::update( 'visitors', $data, array( 'id' => $id ) );
	}

	public static function block( int $visitor_id, string $reason, bool $network, string $actor_type, string $actor_ref ): void {
		$visitor = self::get( $visitor_id );
		if ( ! $visitor ) {
			return;
		}
		Db::update(
			'visitors',
			array(
				'is_blocked'     => 1,
				'blocked_reason' => mb_substr( $reason, 0, 190 ),
				'blocked_at'     => Clock::mysql(),
			),
			array( 'id' => $visitor_id )
		);
		if ( $network && '' !== $visitor['network_hash'] ) {
			$list   = (array) get_option( self::BLOCKED_NETWORKS, array() );
			$list[] = (string) $visitor['network_hash'];
			update_option( self::BLOCKED_NETWORKS, array_values( array_unique( array_slice( $list, -5000 ) ) ), false );
		}
		SessionManager::revoke_visitor( $visitor_id );
		Events::record( 'visitor.blocked', $actor_type, $actor_ref, null, 'visitor', (string) $visitor_id, array( 'network' => $network ) );
	}

	public static function unblock( int $visitor_id, string $actor_type, string $actor_ref ): void {
		$visitor = self::get( $visitor_id );
		if ( ! $visitor ) {
			return;
		}
		Db::update( 'visitors', array( 'is_blocked' => 0, 'blocked_reason' => '', 'blocked_at' => null ), array( 'id' => $visitor_id ) );
		$list = array_values( array_diff( (array) get_option( self::BLOCKED_NETWORKS, array() ), array( (string) $visitor['network_hash'] ) ) );
		update_option( self::BLOCKED_NETWORKS, $list, false );
		Events::record( 'visitor.unblocked', $actor_type, $actor_ref, null, 'visitor', (string) $visitor_id );
	}

	public static function network_blocked( string $hash ): bool {
		return in_array( $hash, (array) get_option( self::BLOCKED_NETWORKS, array() ), true );
	}
}
