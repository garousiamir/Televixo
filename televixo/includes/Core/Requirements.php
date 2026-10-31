<?php
/**
 * Runtime environment checks (see docs/capabilities.md for the matrix).
 *
 * @package Televixo
 */

namespace Televixo\Core;

defined( 'ABSPATH' ) || exit;

final class Requirements {

	/**
	 * Blocking problems that prevent activation.
	 *
	 * @return string[]
	 */
	public static function problems(): array {
		global $wpdb;
		$out = array();
		if ( version_compare( PHP_VERSION, TELEVIXO_MIN_PHP, '<' ) ) {
			/* translators: %s: PHP version */
			$out[] = sprintf( __( 'PHP %s or newer is required.', 'televixo' ), TELEVIXO_MIN_PHP );
		}
		foreach ( array( 'sodium', 'json', 'mbstring', 'fileinfo' ) as $ext ) {
			if ( ! extension_loaded( $ext ) ) {
				/* translators: %s: PHP extension name */
				$out[] = sprintf( __( 'The PHP extension "%s" is required.', 'televixo' ), $ext );
			}
		}
		$db = self::database();
		if ( ! $db['supported_floor'] ) {
			/* translators: %s: database server version */
			$out[] = sprintf( __( 'MySQL 5.7+ or MariaDB 10.4+ with InnoDB is required (found %s).', 'televixo' ), $db['version'] );
		}
		if ( 'utf8mb4' !== $wpdb->charset ) {
			$out[] = __( 'The database connection must use the utf8mb4 character set.', 'televixo' );
		}
		return $out;
	}

	/**
	 * Non-blocking warnings shown in diagnostics.
	 *
	 * @return string[]
	 */
	public static function warnings(): array {
		$out = array();
		$db  = self::database();
		if ( $db['supported_floor'] && ! $db['vendor_supported'] ) {
			$out[] = 'database_version_eol';
		}
		if ( version_compare( PHP_VERSION, '8.3', '<' ) ) {
			$out[] = 'php_82_security_only';
		}
		if ( ! function_exists( 'fastcgi_finish_request' ) && ! function_exists( 'litespeed_finish_request' ) ) {
			$out[] = 'no_finish_request_loopback_used';
		}
		if ( ! wp_http_supports( array( 'ssl' ) ) ) {
			$out[] = 'https_transport_missing';
		}
		return $out;
	}

	/**
	 * @return array{version:string,is_mariadb:bool,supported_floor:bool,vendor_supported:bool}
	 */
	public static function database(): array {
		global $wpdb;
		$raw     = (string) $wpdb->get_var( 'SELECT VERSION()' );
		$maria   = stripos( $raw, 'mariadb' ) !== false;
		$version = preg_match( '/^(\d+\.\d+(\.\d+)?)/', $raw, $m ) ? $m[1] : '0';
		$floor   = $maria ? version_compare( $version, '10.4', '>=' ) : version_compare( $version, '5.7', '>=' );
		// Vendor-supported lines as of the release date (docs/capabilities.md).
		$vendor = $maria
			? ( version_compare( $version, '10.11', '>=' ) )
			: ( version_compare( $version, '8.4', '>=' ) );
		return array(
			'version'          => $raw,
			'is_mariadb'       => $maria,
			'supported_floor'  => $floor,
			'vendor_supported' => $vendor,
		);
	}
}
