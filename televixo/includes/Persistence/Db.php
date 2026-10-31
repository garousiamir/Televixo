<?php
/**
 * Thin wrapper over $wpdb with transactions and strict error handling.
 *
 * @package Televixo
 */

namespace Televixo\Persistence;

defined( 'ABSPATH' ) || exit;

final class Db {

	private static int $depth = 0;

	public static function wpdb(): \wpdb {
		global $wpdb;
		return $wpdb;
	}

	/**
	 * Runs $fn inside a transaction. Nested calls join the outer transaction.
	 *
	 * @template T
	 * @param callable():T $fn
	 * @return T
	 * @throws \Throwable Rethrows after rollback.
	 */
	public static function transaction( callable $fn ) {
		$wpdb = self::wpdb();
		if ( self::$depth > 0 ) {
			++self::$depth;
			try {
				return $fn();
			} finally {
				--self::$depth;
			}
		}
		// When an outer transaction is already open (e.g. a test harness or a
		// caller's own transaction on MariaDB, which exposes @@in_transaction),
		// use a savepoint so its atomicity is preserved instead of committed.
		$suppress = $wpdb->suppress_errors( true );
		$outer    = (int) $wpdb->get_var( 'SELECT @@in_transaction' ) === 1;
		$wpdb->suppress_errors( $suppress );
		$wpdb->query( $outer ? 'SAVEPOINT televixo_tx' : 'START TRANSACTION' ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- constant statements only.
		self::$depth = 1;
		try {
			$result = $fn();
			$wpdb->query( $outer ? 'RELEASE SAVEPOINT televixo_tx' : 'COMMIT' ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- constant statements only.
			return $result;
		} catch ( \Throwable $e ) {
			$wpdb->query( $outer ? 'ROLLBACK TO SAVEPOINT televixo_tx' : 'ROLLBACK' ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- constant statements only.
			throw $e;
		} finally {
			self::$depth = 0;
		}
	}

	/**
	 * Inserts a row and returns its ID; throws on failure so callers inside a
	 * transaction roll back instead of continuing with partial state.
	 *
	 * @param array<string,mixed> $data
	 * @throws DbException On failure.
	 */
	public static function insert( string $table, array $data ): int {
		$wpdb = self::wpdb();
		$ok   = $wpdb->insert( Schema::table( $table ), $data );
		if ( false === $ok ) {
			throw new DbException( 'insert_failed', $wpdb->last_error );
		}
		return (int) $wpdb->insert_id;
	}

	/**
	 * Insert that tolerates a duplicate-key collision. Returns 0 when the row
	 * already existed.
	 *
	 * @param array<string,mixed> $data
	 * @throws DbException On non-duplicate failure.
	 */
	public static function insert_ignore_duplicate( string $table, array $data ): int {
		$wpdb       = self::wpdb();
		$suppress   = $wpdb->suppress_errors( true );
		$ok         = $wpdb->insert( Schema::table( $table ), $data );
		$last_error = $wpdb->last_error;
		$wpdb->suppress_errors( $suppress );
		if ( false === $ok ) {
			if ( str_contains( $last_error, 'Duplicate entry' ) ) {
				return 0;
			}
			throw new DbException( 'insert_failed', $last_error );
		}
		return (int) $wpdb->insert_id;
	}

	/**
	 * @param array<string,mixed> $data
	 * @param array<string,mixed> $where
	 * @throws DbException On failure.
	 */
	public static function update( string $table, array $data, array $where ): int {
		$wpdb = self::wpdb();
		$n    = $wpdb->update( Schema::table( $table ), $data, $where );
		if ( false === $n ) {
			throw new DbException( 'update_failed', $wpdb->last_error );
		}
		return (int) $n;
	}

	/**
	 * Executes a prepared statement and returns affected rows.
	 *
	 * @throws DbException On failure.
	 */
	public static function exec( string $sql ): int {
		$wpdb = self::wpdb();
		$n    = $wpdb->query( $sql ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- callers pass prepared SQL.
		if ( false === $n ) {
			throw new DbException( 'query_failed', $wpdb->last_error );
		}
		return (int) $n;
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function row( string $sql ): ?array {
		$row = self::wpdb()->get_row( $sql, ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		return is_array( $row ) ? $row : null;
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function rows( string $sql ): array {
		$rows = self::wpdb()->get_results( $sql, ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		return is_array( $rows ) ? $rows : array();
	}

	/**
	 * @return mixed
	 */
	public static function var( string $sql ) {
		return self::wpdb()->get_var( $sql ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
	}

	/**
	 * $wpdb->prepare() wrapper that resolves {table} placeholders.
	 *
	 * @param mixed ...$args
	 */
	public static function prepare( string $sql, ...$args ): string {
		$sql = preg_replace_callback(
			'/\{([a-z_]+)\}/',
			static fn( array $m ): string => Schema::table( $m[1] ),
			$sql
		);
		if ( ! $args ) {
			return $sql;
		}
		return self::wpdb()->prepare( $sql, ...$args ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
	}

	/**
	 * Comma separated %d placeholders for an IN() list.
	 *
	 * @param int[] $ids
	 */
	public static function in_ints( array $ids ): string {
		$ids = array_values( array_unique( array_map( 'intval', $ids ) ) );
		return $ids ? implode( ',', $ids ) : '0';
	}
}
