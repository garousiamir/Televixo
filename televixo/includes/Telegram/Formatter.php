<?php
/**
 * Builds plain-text Telegram messages. No parse_mode is used, so visitor text
 * can never inject Telegram markup or entities.
 *
 * Telegram limits text to 4096 characters and captions to 1024 (counted in
 * UTF-16 code units after entity parsing). Chunks are kept below those
 * limits with headroom for the reference header.
 *
 * @package Televixo
 */

namespace Televixo\Telegram;

defined( 'ABSPATH' ) || exit;

final class Formatter {

	public const TEXT_LIMIT    = 4096;
	public const CAPTION_LIMIT = 1024;
	public const CHUNK_BODY    = 3800;

	public static function utf16_length( string $s ): int {
		return (int) ( strlen( (string) mb_convert_encoding( $s, 'UTF-16LE', 'UTF-8' ) ) / 2 );
	}

	/**
	 * Splits text into chunks of at most $limit UTF-16 units, preferring
	 * paragraph, line and word boundaries and never splitting a code point.
	 *
	 * @return string[]
	 */
	public static function chunk( string $text, int $limit = self::CHUNK_BODY ): array {
		$text = trim( $text );
		if ( '' === $text ) {
			return array();
		}
		$chunks = array();
		while ( self::utf16_length( $text ) > $limit ) {
			$cut   = self::max_prefix( $text, $limit );
			$slice = mb_substr( $text, 0, $cut );
			$best  = max( (int) mb_strrpos( $slice, "\n\n" ), (int) mb_strrpos( $slice, "\n" ), (int) mb_strrpos( $slice, ' ' ) );
			if ( $best < (int) ( $cut * 0.5 ) ) {
				$best = $cut;
			}
			$chunks[] = rtrim( mb_substr( $text, 0, $best ) );
			$text     = ltrim( mb_substr( $text, $best ) );
		}
		if ( '' !== $text ) {
			$chunks[] = $text;
		}
		return $chunks;
	}

	private static function max_prefix( string $text, int $limit ): int {
		$lo = 0;
		$hi = mb_strlen( $text );
		while ( $lo < $hi ) {
			$mid = intdiv( $lo + $hi + 1, 2 );
			if ( self::utf16_length( mb_substr( $text, 0, $mid ) ) <= $limit ) {
				$lo = $mid;
			} else {
				$hi = $mid - 1;
			}
		}
		return max( 1, $lo );
	}

	/**
	 * Header line identifying the conversation in Reply Mode. The reference is
	 * informational; routing uses stored message mappings, never this text.
	 *
	 * @param array<string,mixed> $conversation
	 * @param array<string,mixed> $visitor
	 * @param string[]            $fields Approved context fields.
	 */
	public static function header( array $conversation, array $visitor, array $fields, bool $first, int $part = 1, int $parts = 1 ): string {
		$name = '' !== trim( (string) ( $visitor['name'] ?? '' ) ) && in_array( 'name', $fields, true ) ? (string) $visitor['name'] : __( 'Visitor', 'televixo' );
		$line = '💬 ' . $conversation['reference'] . ' · ' . self::clean( $name );
		if ( $parts > 1 ) {
			$line .= sprintf( ' (%d/%d)', $part, $parts );
		}
		if ( ! $first ) {
			return $line;
		}
		$ctx   = json_decode( (string) ( $conversation['context'] ?? '' ), true );
		$ctx   = is_array( $ctx ) ? $ctx : array();
		$lines = array( $line );
		if ( in_array( 'email', $fields, true ) && ! empty( $visitor['email'] ) ) {
			$lines[] = '✉️ ' . self::clean( (string) $visitor['email'] );
		}
		if ( in_array( 'phone', $fields, true ) && ! empty( $visitor['phone'] ) ) {
			$lines[] = '📞 ' . self::clean( (string) $visitor['phone'] );
		}
		if ( in_array( 'department', $fields, true ) && ! empty( $conversation['department'] ) ) {
			$lines[] = '🏷 ' . self::clean( (string) $conversation['department'] );
		}
		if ( in_array( 'page', $fields, true ) && ! empty( $ctx['page_path'] ) ) {
			$lines[] = '🌐 ' . self::clean( (string) $ctx['page_path'] );
		}
		if ( in_array( 'referrer', $fields, true ) && ! empty( $ctx['referrer_host'] ) ) {
			$lines[] = '↪️ ' . self::clean( (string) $ctx['referrer_host'] );
		}
		return implode( "\n", $lines );
	}

	public static function topic_name( array $conversation, array $visitor ): string {
		$name = trim( (string) ( $visitor['name'] ?? '' ) );
		$name = '' === $name ? __( 'Visitor', 'televixo' ) : $name;
		// Topic names are limited to 128 characters.
		return mb_substr( $conversation['reference'] . ' · ' . self::clean( $name ), 0, 120 );
	}

	public static function clean( string $s ): string {
		return trim( (string) preg_replace( '/[\x00-\x1F\x7F]+/u', ' ', $s ) );
	}
}
