<?php
/**
 * File access through the WordPress Filesystem API (direct method, since
 * Televixo only touches its own private storage directory).
 *
 * @package Televixo
 */

namespace Televixo\Core;

defined( 'ABSPATH' ) || exit;

final class Fs {

	private static ?\WP_Filesystem_Base $fs = null;

	public static function fs(): \WP_Filesystem_Base {
		if ( null === self::$fs ) {
			require_once ABSPATH . 'wp-admin/includes/file.php';
			require_once ABSPATH . 'wp-admin/includes/class-wp-filesystem-base.php';
			require_once ABSPATH . 'wp-admin/includes/class-wp-filesystem-direct.php';
			self::$fs = new \WP_Filesystem_Direct( null );
		}
		return self::$fs;
	}

	public static function put( string $path, string $contents ): bool {
		return self::fs()->put_contents( $path, $contents, defined( 'FS_CHMOD_FILE' ) ? FS_CHMOD_FILE : 0644 );
	}

	public static function get( string $path ): string {
		$c = self::fs()->get_contents( $path );
		return is_string( $c ) ? $c : '';
	}

	public static function rmdir( string $path, bool $recursive = false ): bool {
		return self::fs()->rmdir( $path, $recursive );
	}
}
