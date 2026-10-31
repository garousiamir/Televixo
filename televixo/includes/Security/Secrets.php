<?php
/**
 * Recoverable secrets (bot token, webhook secret) with authenticated
 * encryption at rest (libsodium XSalsa20-Poly1305 secretbox).
 *
 * Key strategy (docs/security.md#keys):
 * - TELEVIXO_ENCRYPTION_KEY (wp-config.php, base64 of 32 bytes) is preferred.
 * - Otherwise a key is derived with HKDF from the site's AUTH_KEY and
 *   SECURE_AUTH_KEY salts, so the database alone cannot decrypt secrets.
 * - TELEVIXO_ENCRYPTION_KEY_PREVIOUS lets old ciphertext be read during a
 *   rotation; `wp televixo secrets rotate` re-encrypts with the current key.
 * - TELEVIXO_TELEGRAM_BOT_TOKEN overrides the stored token entirely.
 *
 * @package Televixo
 */

namespace Televixo\Security;

defined( 'ABSPATH' ) || exit;

final class Secrets {

	public const OPTION  = 'televixo_secrets';
	private const PREFIX = 'tvx1';

	public static function bot_token(): string {
		if ( defined( 'TELEVIXO_TELEGRAM_BOT_TOKEN' ) && is_string( TELEVIXO_TELEGRAM_BOT_TOKEN ) && '' !== TELEVIXO_TELEGRAM_BOT_TOKEN ) {
			return TELEVIXO_TELEGRAM_BOT_TOKEN;
		}
		return self::get( 'bot_token' );
	}

	public static function bot_token_from_config(): bool {
		return defined( 'TELEVIXO_TELEGRAM_BOT_TOKEN' ) && '' !== (string) TELEVIXO_TELEGRAM_BOT_TOKEN;
	}

	public static function webhook_secret(): string {
		$secret = self::get( 'webhook_secret' );
		if ( '' === $secret ) {
			// Telegram accepts 1-256 characters from A-Z, a-z, 0-9, _ and -.
			$secret = Random::secret( 48 );
			self::set( 'webhook_secret', $secret );
		}
		return $secret;
	}

	/**
	 * Stable random identifier for this installation, used to recognise
	 * whether a registered webhook belongs to this site.
	 */
	public static function install_id(): string {
		$id = (string) get_option( 'televixo_install_id', '' );
		if ( '' === $id ) {
			$id = Random::hex( 12 );
			update_option( 'televixo_install_id', $id, false );
		}
		return $id;
	}

	/**
	 * Server-side pepper for token hashing; never leaves the server.
	 */
	public static function pepper(): string {
		return hash_hkdf( 'sha256', self::key_material(), 32, 'televixo-token-pepper-v1' );
	}

	public static function get( string $name ): string {
		$all = get_option( self::OPTION, array() );
		if ( ! is_array( $all ) || empty( $all[ $name ] ) ) {
			return '';
		}
		$plain = self::decrypt( (string) $all[ $name ] );
		return null === $plain ? '' : $plain;
	}

	public static function set( string $name, string $value ): void {
		$all = get_option( self::OPTION, array() );
		$all = is_array( $all ) ? $all : array();
		if ( '' === $value ) {
			unset( $all[ $name ] );
		} else {
			$all[ $name ] = self::encrypt( $value );
		}
		update_option( self::OPTION, $all, false );
	}

	public static function has( string $name ): bool {
		return '' !== self::get( $name );
	}

	public static function encrypt( string $plain ): string {
		$key   = self::current_key();
		$nonce = random_bytes( SODIUM_CRYPTO_SECRETBOX_NONCEBYTES );
		$box   = sodium_crypto_secretbox( $plain, $nonce, $key );
		return self::PREFIX . ':' . self::key_id( $key ) . ':' . sodium_bin2base64( $nonce . $box, SODIUM_BASE64_VARIANT_ORIGINAL );
	}

	public static function decrypt( string $stored ): ?string {
		$parts = explode( ':', $stored, 3 );
		if ( 3 !== count( $parts ) || self::PREFIX !== $parts[0] ) {
			return null;
		}
		$raw = self::b64decode( $parts[2] );
		if ( null === $raw || strlen( $raw ) <= SODIUM_CRYPTO_SECRETBOX_NONCEBYTES ) {
			return null;
		}
		$nonce = substr( $raw, 0, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES );
		$box   = substr( $raw, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES );
		foreach ( self::candidate_keys() as $key ) {
			if ( ! hash_equals( self::key_id( $key ), $parts[1] ) ) {
				continue;
			}
			$plain = sodium_crypto_secretbox_open( $box, $nonce, $key );
			if ( false !== $plain ) {
				return $plain;
			}
		}
		return null;
	}

	/**
	 * Re-encrypts all stored secrets with the current key.
	 *
	 * @return int Number of secrets re-encrypted.
	 */
	public static function rotate(): int {
		$all = get_option( self::OPTION, array() );
		$n   = 0;
		if ( ! is_array( $all ) ) {
			return 0;
		}
		foreach ( $all as $name => $stored ) {
			$plain = self::decrypt( (string) $stored );
			if ( null !== $plain ) {
				$all[ $name ] = self::encrypt( $plain );
				++$n;
			}
		}
		update_option( self::OPTION, $all, false );
		return $n;
	}

	/**
	 * Names of secrets that can no longer be decrypted (e.g. salts changed).
	 *
	 * @return string[]
	 */
	public static function undecryptable(): array {
		$all = get_option( self::OPTION, array() );
		$bad = array();
		foreach ( is_array( $all ) ? $all : array() as $name => $stored ) {
			if ( null === self::decrypt( (string) $stored ) ) {
				$bad[] = (string) $name;
			}
		}
		return $bad;
	}

	public static function key_source(): string {
		return self::configured_key( 'TELEVIXO_ENCRYPTION_KEY' ) ? 'constant' : 'derived_from_salts';
	}

	private static function current_key(): string {
		return self::configured_key( 'TELEVIXO_ENCRYPTION_KEY' ) ?? self::derived_key();
	}

	/**
	 * @return string[]
	 */
	private static function candidate_keys(): array {
		$keys = array( self::current_key() );
		$prev = self::configured_key( 'TELEVIXO_ENCRYPTION_KEY_PREVIOUS' );
		if ( $prev ) {
			$keys[] = $prev;
		}
		$keys[] = self::derived_key();
		return array_values( array_unique( $keys ) );
	}

	private static function configured_key( string $constant ): ?string {
		if ( ! defined( $constant ) ) {
			return null;
		}
		$raw = self::b64decode( (string) constant( $constant ) );
		return ( null !== $raw && SODIUM_CRYPTO_SECRETBOX_KEYBYTES === strlen( $raw ) ) ? $raw : null;
	}

	/**
	 * Strict standard Base64 decoding (libsodium; same alphabet as base64_encode).
	 */
	private static function b64decode( string $in ): ?string {
		try {
			return sodium_base642bin( $in, SODIUM_BASE64_VARIANT_ORIGINAL );
		} catch ( \SodiumException $e ) {
			return null;
		}
	}

	private static function derived_key(): string {
		return hash_hkdf( 'sha256', self::key_material(), SODIUM_CRYPTO_SECRETBOX_KEYBYTES, 'televixo-secrets-v1' );
	}

	private static function key_material(): string {
		$material = ( defined( 'AUTH_KEY' ) ? AUTH_KEY : '' ) . '|' . ( defined( 'SECURE_AUTH_KEY' ) ? SECURE_AUTH_KEY : '' );
		if ( strlen( $material ) < 32 ) {
			$material .= '|' . wp_salt( 'auth' );
		}
		return $material;
	}

	private static function key_id( string $key ): string {
		return substr( hash( 'sha256', 'kid|' . $key ), 0, 8 );
	}
}
