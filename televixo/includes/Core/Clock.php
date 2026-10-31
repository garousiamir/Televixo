<?php
/**
 * UTC clock. All persistence uses UTC; display localizes via wp_date().
 *
 * @package Televixo
 */

namespace Televixo\Core;

defined( 'ABSPATH' ) || exit;

final class Clock {

	/** @var int|null Frozen timestamp for tests. */
	private static ?int $frozen = null;

	public static function now(): int {
		return self::$frozen ?? time();
	}

	public static function mysql( ?int $ts = null ): string {
		return gmdate( 'Y-m-d H:i:s', $ts ?? self::now() );
	}

	public static function to_ts( ?string $mysql ): ?int {
		if ( null === $mysql || '' === $mysql ) {
			return null;
		}
		$ts = strtotime( $mysql . ' UTC' );
		return false === $ts ? null : $ts;
	}

	public static function iso( ?string $mysql ): ?string {
		$ts = self::to_ts( $mysql );
		return null === $ts ? null : gmdate( 'Y-m-d\TH:i:s\Z', $ts );
	}

	public static function freeze( ?int $ts ): void {
		self::$frozen = $ts;
	}
}
