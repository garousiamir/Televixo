<?php
/**
 * Random identifiers and secrets.
 *
 * @package Televixo
 */

namespace Televixo\Security;

defined( 'ABSPATH' ) || exit;

final class Random {

	private const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz'; // Crockford base32, lower case.

	/**
	 * 26-character public identifier (130 bits of randomness).
	 */
	public static function public_id(): string {
		return self::base32( 26 );
	}

	/**
	 * Short human reference such as "C-7K2M9Q". Not a credential.
	 */
	public static function reference(): string {
		return 'C-' . strtoupper( self::base32( 8 ) );
	}

	public static function base32( int $length ): string {
		$out   = '';
		$bytes = random_bytes( $length );
		for ( $i = 0; $i < $length; $i++ ) {
			$out .= self::ALPHABET[ ord( $bytes[ $i ] ) & 31 ];
		}
		return $out;
	}

	/**
	 * High-entropy secret (256 bits), base64url.
	 */
	public static function secret( int $bytes = 32 ): string {
		return sodium_bin2base64( random_bytes( $bytes ), SODIUM_BASE64_VARIANT_URLSAFE_NO_PADDING );
	}

	public static function hex( int $bytes = 16 ): string {
		return bin2hex( random_bytes( $bytes ) );
	}
}
