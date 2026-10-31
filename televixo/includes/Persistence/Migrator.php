<?php
/**
 * Versioned schema migrations.
 *
 * Each migration has an integer version. dbDelta() is idempotent for table
 * shape; data migrations are added as explicit callbacks so upgrades from any
 * prior version replay in order.
 *
 * @package Televixo
 */

namespace Televixo\Persistence;

use Televixo\Core\Clock;

defined( 'ABSPATH' ) || exit;

final class Migrator {

	public const OPTION          = 'televixo_db_version';
	public const CURRENT         = 1;
	private const LOCK_TRANSIENT = 'televixo_migrating';

	/**
	 * @return array<int,callable():void>
	 */
	private static function migrations(): array {
		return array(
			1 => static function (): void {
				self::apply_schema();
			},
		);
	}

	public static function installed_version(): int {
		return (int) get_option( self::OPTION, 0 );
	}

	public static function needs_migration(): bool {
		return self::installed_version() < self::CURRENT;
	}

	/**
	 * Runs pending migrations. A short lock prevents two concurrent requests
	 * from migrating at once.
	 */
	public static function migrate(): bool {
		if ( ! self::needs_migration() ) {
			return true;
		}
		if ( get_transient( self::LOCK_TRANSIENT ) ) {
			return false;
		}
		set_transient( self::LOCK_TRANSIENT, 1, 5 * MINUTE_IN_SECONDS );
		try {
			foreach ( self::migrations() as $version => $callback ) {
				if ( $version <= self::installed_version() ) {
					continue;
				}
				$callback();
				update_option( self::OPTION, $version, true );
			}
			// Re-apply the full schema so tables added in later versions exist
			// regardless of the path taken.
			self::apply_schema();
			update_option( 'televixo_db_migrated_at', Clock::mysql(), false );
		} finally {
			delete_transient( self::LOCK_TRANSIENT );
		}
		return true;
	}

	public static function apply_schema(): void {
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		foreach ( Schema::statements() as $sql ) {
			dbDelta( $sql );
		}
	}

	/**
	 * @return string[] Missing logical table names.
	 */
	public static function missing_tables(): array {
		$wpdb    = Db::wpdb();
		$missing = array();
		foreach ( Schema::TABLES as $name ) {
			$table = Schema::table( $name );
			if ( $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $wpdb->esc_like( $table ) ) ) !== $table ) {
				$missing[] = $name;
			}
		}
		return $missing;
	}

	public static function drop_all(): void {
		$wpdb = Db::wpdb();
		foreach ( Schema::TABLES as $name ) {
			$wpdb->query( 'DROP TABLE IF EXISTS ' . Schema::table( $name ) ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared,WordPress.DB.DirectDatabaseQuery.SchemaChange
		}
		delete_option( self::OPTION );
	}
}
