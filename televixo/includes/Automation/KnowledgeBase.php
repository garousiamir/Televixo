<?php
/**
 * FAQ / knowledge base cards with simple keyword search. Content is
 * authored by administrators and stored as plain text.
 *
 * @package Televixo
 */

namespace Televixo\Automation;

use Televixo\Core\Clock;
use Televixo\Persistence\Db;

defined( 'ABSPATH' ) || exit;

final class KnowledgeBase {

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function search( string $q, int $limit = 8 ): array {
		$q = trim( $q );
		if ( '' === $q ) {
			$rows = Db::rows( Db::prepare( "SELECT id, title, body FROM {kb_articles} WHERE status = 'published' ORDER BY sort_order ASC, id ASC LIMIT %d", $limit ) );
		} else {
			$like = '%' . Db::wpdb()->esc_like( mb_substr( $q, 0, 100 ) ) . '%';
			$rows = Db::rows(
				Db::prepare(
					"SELECT id, title, body FROM {kb_articles} WHERE status = 'published' AND (title LIKE %s OR keywords LIKE %s OR body LIKE %s)
					ORDER BY (title LIKE %s) DESC, sort_order ASC, id ASC LIMIT %d",
					$like,
					$like,
					$like,
					$like,
					$limit
				)
			);
		}
		return array_map( array( self::class, 'shape' ), $rows );
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function suggested(): array {
		$rows = Db::rows( Db::prepare( "SELECT id, title, body FROM {kb_articles} WHERE status = 'published' AND is_suggested = 1 ORDER BY sort_order ASC, id ASC LIMIT 4" ) );
		return array_map( array( self::class, 'shape' ), $rows );
	}

	public static function count(): int {
		return (int) Db::var( Db::prepare( "SELECT COUNT(*) FROM {kb_articles} WHERE status = 'published'" ) );
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function all(): array {
		return Db::rows( Db::prepare( 'SELECT * FROM {kb_articles} ORDER BY sort_order ASC, id ASC LIMIT 500' ) );
	}

	/**
	 * @param array<string,mixed> $in
	 */
	public static function save( array $in, int $id = 0 ): int {
		$data = array(
			'title'        => mb_substr( sanitize_text_field( (string) ( $in['title'] ?? '' ) ), 0, 190 ),
			'body'         => mb_substr( sanitize_textarea_field( (string) ( $in['body'] ?? '' ) ), 0, 5000 ),
			'keywords'     => mb_substr( sanitize_text_field( (string) ( $in['keywords'] ?? '' ) ), 0, 255 ),
			'is_suggested' => ! empty( $in['is_suggested'] ) ? 1 : 0,
			'status'       => 'draft' === ( $in['status'] ?? '' ) ? 'draft' : 'published',
			'sort_order'   => (int) ( $in['sort_order'] ?? 0 ),
			'updated_at'   => Clock::mysql(),
		);
		if ( '' === $data['title'] ) {
			throw new \Televixo\Domain\DomainException( 'title_required', __( 'Title is required.', 'televixo' ), 422 );
		}
		if ( $id ) {
			Db::update( 'kb_articles', $data, array( 'id' => $id ) );
			return $id;
		}
		$data['created_at'] = Clock::mysql();
		return Db::insert( 'kb_articles', $data );
	}

	public static function delete( int $id ): void {
		Db::exec( Db::prepare( 'DELETE FROM {kb_articles} WHERE id = %d', $id ) );
	}

	/**
	 * @return array<string,mixed>
	 */
	private static function shape( array $r ): array {
		return array( 'id' => (int) $r['id'], 'title' => (string) $r['title'], 'body' => (string) $r['body'] );
	}
}
