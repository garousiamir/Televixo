<?php
/**
 * Response shapes. Internal IDs are never exposed to visitors except the
 * monotonically increasing message cursor.
 *
 * @package Televixo
 */

namespace Televixo\REST;

use Televixo\Core\Clock;
use Televixo\Domain\Attachments;

defined( 'ABSPATH' ) || exit;

final class Serializer {

	/**
	 * @param array<int,array<string,mixed>> $rows
	 * @return array<int,array<string,mixed>>
	 */
	public static function visitor_messages( array $rows, array $conversation ): array {
		$atts = Attachments::for_messages( array_map( static fn( $r ) => (int) $r['id'], $rows ) );
		$out  = array();
		foreach ( $rows as $r ) {
			$out[] = self::visitor_message( $r, $conversation, $atts[ (int) $r['id'] ] ?? array() );
		}
		return $out;
	}

	/**
	 * @param array<int,array<string,mixed>> $atts
	 * @return array<string,mixed>
	 */
	public static function visitor_message( array $r, array $conversation, array $atts = array() ): array {
		$state = null;
		if ( 'visitor' === $r['author_type'] ) {
			$state = 'sent';
			if ( (int) $conversation['operator_read_id'] >= (int) $r['id'] ) {
				$state = 'read';
			} elseif ( 'provider_accepted' === $r['delivery_state'] ) {
				$state = 'delivered';
			} elseif ( 'failed' === $r['delivery_state'] ) {
				$state = 'failed';
			}
		}
		return array(
			'id'          => (string) $r['public_id'],
			'cursor'      => (int) $r['id'],
			'author'      => (string) $r['author_type'],
			'author_name' => 'operator' === $r['author_type'] ? self::first_name( (string) $r['author_name'] ) : ( 'automation' === $r['author_type'] ? (string) $r['author_name'] : '' ),
			'body'        => null !== $r['redacted_at'] ? '' : (string) $r['body'],
			'redacted'    => null !== $r['redacted_at'],
			'created_at'  => Clock::iso( (string) $r['created_at'] ),
			'state'       => $state,
			'attachments' => array_map( array( self::class, 'attachment' ), $atts ),
		);
	}

	/**
	 * @return array<string,mixed>
	 */
	public static function attachment( array $a ): array {
		return array(
			'id'     => (string) $a['public_id'],
			'name'   => (string) $a['original_name'],
			'mime'   => (string) $a['mime'],
			'kind'   => (string) $a['kind'],
			'size'   => (int) $a['size_bytes'],
			'width'  => (int) $a['width'],
			'height' => (int) $a['height'],
			'url'    => rest_url( Controller::NS . '/attachments/' . $a['public_id'] ),
		);
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function visitor_conversation( ?array $c ): ?array {
		if ( ! $c ) {
			return null;
		}
		$now = Clock::now();
		return array(
			'id'              => (string) $c['public_id'],
			'reference'       => (string) $c['reference'],
			'status'          => (string) $c['status'],
			'active'          => ! in_array( $c['status'], array( 'closed', 'spam' ), true ),
			'human_engaged'   => (bool) $c['human_engaged'],
			'operator_typing' => ( Clock::to_ts( $c['operator_typing_until'] ?? null ) ?? 0 ) > $now,
			'operator_read'   => (int) $c['operator_read_id'],
			'visitor_read'    => (int) $c['visitor_read_id'],
			'last_cursor'     => (int) $c['last_message_id'],
			'rated'           => (bool) ( $c['rated'] ?? false ),
			'created_at'      => Clock::iso( (string) $c['created_at'] ),
		);
	}

	private static function first_name( string $name ): string {
		$parts = preg_split( '/\s+/', trim( $name ) );
		return $parts ? (string) $parts[0] : '';
	}
}
