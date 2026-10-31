<?php
/**
 * Plain-text transcript download (public messages only).
 *
 * @package Televixo
 */

namespace Televixo\Privacy;

use Televixo\Persistence\Db;

defined( 'ABSPATH' ) || exit;

final class Transcript {

	public static function build( array $conversation ): string {
		$lines = array(
			/* translators: %s: conversation reference */
			sprintf( __( 'Conversation %s', 'televixo' ), $conversation['reference'] ),
			get_bloginfo( 'name' ),
			str_repeat( '-', 40 ),
		);
		$last = 0;
		do {
			$rows = Db::rows( Db::prepare( 'SELECT * FROM {messages} WHERE conversation_id = %d AND id > %d ORDER BY id ASC LIMIT 500', (int) $conversation['id'], $last ) );
			foreach ( $rows as $r ) {
				$last  = (int) $r['id'];
				$who   = match ( $r['author_type'] ) {
					'visitor'    => __( 'You', 'televixo' ),
					'operator'   => (string) $r['author_name'],
					'automation' => __( 'Automated message', 'televixo' ),
					default      => __( 'System', 'televixo' ),
				};
				$when    = wp_date( get_option( 'date_format' ) . ' ' . get_option( 'time_format' ), (int) strtotime( $r['created_at'] . ' UTC' ) );
				$lines[] = sprintf( '[%s] %s:', $when, $who );
				$lines[] = null !== $r['redacted_at'] ? __( '(removed)', 'televixo' ) : (string) $r['body'];
				$lines[] = '';
			}
		} while ( count( $rows ) === 500 );
		return implode( "\n", $lines );
	}

	public static function send( array $conversation ): void {
		$text = self::build( $conversation );
		nocache_headers();
		header( 'Content-Type: text/plain; charset=utf-8' );
		header( 'X-Content-Type-Options: nosniff' );
		header( 'Content-Disposition: attachment; filename="transcript-' . preg_replace( '/[^A-Z0-9-]/', '', (string) $conversation['reference'] ) . '.txt"' );
		echo $text; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- text/plain download.
		exit;
	}
}
