<?php
/**
 * Rule storage, import/export.
 *
 * @package Televixo
 */

namespace Televixo\Rules;

use Televixo\Core\Clock;
use Televixo\Domain\DomainException;
use Televixo\Persistence\Db;

defined( 'ABSPATH' ) || exit;

final class Repository {

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function all(): array {
		$rows = Db::rows( Db::prepare( 'SELECT * FROM {rules} ORDER BY priority DESC, id ASC LIMIT 200' ) );
		return array_map( array( self::class, 'hydrate' ), $rows );
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function get( int $id ): ?array {
		$row = Db::row( Db::prepare( 'SELECT * FROM {rules} WHERE id = %d', $id ) );
		return $row ? self::hydrate( $row ) : null;
	}

	/**
	 * Enabled rules as shipped to the widget (definitions only).
	 *
	 * @return array<int,array<string,mixed>>
	 */
	public static function public_rules(): array {
		$out = array();
		foreach ( Db::rows( Db::prepare( "SELECT * FROM {rules} WHERE status = 'enabled' ORDER BY priority DESC, id ASC LIMIT 100" ) ) as $row ) {
			$r     = self::hydrate( $row );
			$out[] = array( 'id' => $r['id'], 'priority' => $r['priority'], 'revision' => $r['revision'], 'definition' => $r['definition'] );
		}
		return $out;
	}

	/**
	 * @param array<string,mixed> $in
	 * @throws DomainException On validation errors.
	 */
	public static function save( array $in, int $id = 0 ): array {
		$v = Schema::validate( $in['definition'] ?? null );
		if ( ! $v['ok'] ) {
			throw new DomainException( 'rule_invalid', implode( '; ', $v['errors'] ), 422 );
		}
		$name = mb_substr( sanitize_text_field( (string) ( $in['name'] ?? '' ) ), 0, 190 );
		if ( '' === $name ) {
			throw new DomainException( 'rule_invalid', __( 'Rule name is required.', 'televixo' ), 422 );
		}
		$data = array(
			'name'       => $name,
			'status'     => 'enabled' === ( $in['status'] ?? '' ) ? 'enabled' : 'disabled',
			'priority'   => max( -1000, min( 1000, (int) ( $in['priority'] ?? 10 ) ) ),
			'definition' => wp_json_encode( $v['definition'] ),
			'updated_at' => Clock::mysql(),
		);
		if ( $id ) {
			if ( ! self::get( $id ) ) {
				throw new DomainException( 'rule_not_found', __( 'Rule not found.', 'televixo' ), 404 );
			}
			Db::exec( Db::prepare( 'UPDATE {rules} SET revision = revision + 1 WHERE id = %d', $id ) );
			Db::update( 'rules', $data, array( 'id' => $id ) );
		} else {
			$data['created_at'] = Clock::mysql();
			$data['created_by'] = get_current_user_id() ?: null;
			$id                 = Db::insert( 'rules', $data );
		}
		return self::get( $id ) ?? array();
	}

	public static function delete( int $id ): void {
		Db::exec( Db::prepare( 'DELETE FROM {rules} WHERE id = %d', $id ) );
	}

	/**
	 * @return array<string,mixed>
	 */
	public static function export(): array {
		return array(
			'format'  => 'televixo-rules',
			'version' => 1,
			'rules'   => array_map( static fn( $r ) => array( 'name' => $r['name'], 'status' => $r['status'], 'priority' => $r['priority'], 'definition' => $r['definition'] ), self::all() ),
		);
	}

	/**
	 * Imports rules as new (disabled by default for safety).
	 *
	 * @param array<string,mixed> $data
	 * @return array{imported:int,errors:string[]}
	 */
	public static function import( array $data, bool $enable = false ): array {
		if ( 'televixo-rules' !== ( $data['format'] ?? '' ) ) {
			throw new DomainException( 'import_invalid', __( 'This is not a Televixo rules export.', 'televixo' ), 422 );
		}
		$n      = 0;
		$errors = array();
		foreach ( array_slice( (array) ( $data['rules'] ?? array() ), 0, 100 ) as $i => $rule ) {
			try {
				$rule['status'] = $enable ? ( $rule['status'] ?? 'disabled' ) : 'disabled';
				self::save( (array) $rule );
				++$n;
			} catch ( DomainException $e ) {
				$errors[] = "rules[$i]: " . $e->getMessage();
			}
		}
		return array( 'imported' => $n, 'errors' => $errors );
	}

	/**
	 * @return array<string,mixed>
	 */
	private static function hydrate( array $row ): array {
		$def = json_decode( (string) $row['definition'], true );
		return array(
			'id'         => (int) $row['id'],
			'name'       => (string) $row['name'],
			'status'     => (string) $row['status'],
			'priority'   => (int) $row['priority'],
			'revision'   => (int) $row['revision'],
			'definition' => is_array( $def ) ? $def : array(),
			'updated_at' => \Televixo\Core\Clock::iso( (string) $row['updated_at'] ),
		);
	}
}
