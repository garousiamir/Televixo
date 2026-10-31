<?php
/**
 * Append-only audit log.
 *
 * @package Televixo
 */

namespace Televixo\Domain;

use Televixo\Core\Clock;
use Televixo\Persistence\Db;
use Televixo\Security\Redactor;

defined( 'ABSPATH' ) || exit;

final class Events {

	/**
	 * @param array<string,mixed> $data
	 */
	public static function record( string $event, string $actor_type, string $actor_ref, ?int $conversation_id = null, string $object_type = '', string $object_id = '', array $data = array() ): void {
		Db::insert(
			'events',
			array(
				'event'           => substr( $event, 0, 64 ),
				'actor_type'      => substr( $actor_type, 0, 16 ),
				'actor_ref'       => substr( $actor_ref, 0, 32 ),
				'conversation_id' => $conversation_id,
				'object_type'     => substr( $object_type, 0, 32 ),
				'object_id'       => substr( $object_id, 0, 32 ),
				'data'            => $data ? wp_json_encode( Redactor::data( $data ) ) : null,
				'created_at'      => Clock::mysql(),
			)
		);
	}

	public static function current_actor(): array {
		$uid = get_current_user_id();
		return $uid ? array( 'user', (string) $uid ) : array( 'system', '' );
	}
}
