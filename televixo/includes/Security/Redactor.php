<?php
/**
 * Removes credentials from strings before they are logged, stored as errors
 * or returned in diagnostics.
 *
 * @package Televixo
 */

namespace Televixo\Security;

defined( 'ABSPATH' ) || exit;

final class Redactor {

	public static function text( string $text ): string {
		// Telegram bot tokens: <digits>:<35+ token chars>, also inside URLs (/bot<token>/, /file/bot<token>/).
		$text = (string) preg_replace( '/\d{5,}:[A-Za-z0-9_-]{30,}/', '[redacted-token]', $text );
		$secret = Secrets::get( 'webhook_secret' );
		if ( '' !== $secret ) {
			$text = str_replace( $secret, '[redacted-secret]', $text );
		}
		$token = Secrets::bot_token();
		if ( '' !== $token ) {
			$text = str_replace( $token, '[redacted-token]', $text );
		}
		return mb_substr( $text, 0, 500 );
	}

	/**
	 * @param mixed $data
	 * @return mixed
	 */
	public static function data( $data ) {
		if ( is_string( $data ) ) {
			return self::text( $data );
		}
		if ( is_array( $data ) ) {
			$out = array();
			foreach ( $data as $k => $v ) {
				$out[ $k ] = preg_match( '/token|secret|password|authorization/i', (string) $k ) ? '[redacted]' : self::data( $v );
			}
			return $out;
		}
		return $data;
	}
}
