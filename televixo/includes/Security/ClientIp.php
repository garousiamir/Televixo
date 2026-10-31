<?php
/**
 * Client network address resolution. Forwarded headers are ignored unless the
 * direct peer is a configured trusted proxy. Raw IPs are never persisted; a
 * keyed hash is used for rate limiting and blocking.
 *
 * @package Televixo
 */

namespace Televixo\Security;

use Televixo\Core\Settings;

defined( 'ABSPATH' ) || exit;

final class ClientIp {

	public static function resolve(): string {
		$remote = isset( $_SERVER['REMOTE_ADDR'] ) ? (string) wp_unslash( $_SERVER['REMOTE_ADDR'] ) : ''; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- validated below.
		if ( ! filter_var( $remote, FILTER_VALIDATE_IP ) ) {
			return '0.0.0.0';
		}
		$proxies = (array) Settings::get( 'privacy.trusted_proxies', array() );
		if ( ! $proxies || ! self::in_any( $remote, $proxies ) ) {
			return $remote;
		}
		$header = isset( $_SERVER['HTTP_X_FORWARDED_FOR'] ) ? (string) wp_unslash( $_SERVER['HTTP_X_FORWARDED_FOR'] ) : ''; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		$chain  = array_reverse( array_map( 'trim', explode( ',', $header ) ) );
		foreach ( $chain as $ip ) {
			if ( ! filter_var( $ip, FILTER_VALIDATE_IP ) ) {
				break;
			}
			if ( ! self::in_any( $ip, $proxies ) ) {
				return $ip;
			}
		}
		return $remote;
	}

	public static function network_hash( ?string $ip = null ): string {
		$ip = $ip ?? self::resolve();
		// IPv6 is grouped by /64 so rotating interface IDs share a bucket.
		if ( str_contains( $ip, ':' ) ) {
			$packed = inet_pton( $ip );
			if ( false !== $packed ) {
				$ip = bin2hex( substr( $packed, 0, 8 ) ) . '::/64';
			}
		}
		return hash_hmac( 'sha256', 'net|' . $ip, Secrets::pepper() );
	}

	public static function valid_cidr( string $value ): bool {
		$parts = explode( '/', $value, 2 );
		if ( ! filter_var( $parts[0], FILTER_VALIDATE_IP ) ) {
			return false;
		}
		if ( ! isset( $parts[1] ) ) {
			return true;
		}
		$max = str_contains( $parts[0], ':' ) ? 128 : 32;
		return ctype_digit( $parts[1] ) && (int) $parts[1] <= $max;
	}

	/**
	 * @param string[] $cidrs
	 */
	public static function in_any( string $ip, array $cidrs ): bool {
		foreach ( $cidrs as $cidr ) {
			if ( self::in_cidr( $ip, (string) $cidr ) ) {
				return true;
			}
		}
		return false;
	}

	public static function in_cidr( string $ip, string $cidr ): bool {
		$parts = explode( '/', $cidr, 2 );
		$net   = inet_pton( $parts[0] );
		$addr  = inet_pton( $ip );
		if ( false === $net || false === $addr || strlen( $net ) !== strlen( $addr ) ) {
			return false;
		}
		$bits  = isset( $parts[1] ) ? (int) $parts[1] : strlen( $net ) * 8;
		$bytes = intdiv( $bits, 8 );
		if ( substr( $net, 0, $bytes ) !== substr( $addr, 0, $bytes ) ) {
			return false;
		}
		$rem = $bits % 8;
		if ( 0 === $rem ) {
			return true;
		}
		$mask = chr( ( 0xff << ( 8 - $rem ) ) & 0xff );
		return ( $net[ $bytes ] & $mask ) === ( $addr[ $bytes ] & $mask );
	}
}
