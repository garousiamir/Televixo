<?php
/**
 * Fixed-window counters in a custom table, incremented atomically with
 * INSERT ... ON DUPLICATE KEY UPDATE so concurrent requests cannot race.
 *
 * @package Televixo
 */

namespace Televixo\Security;

use Televixo\Core\Clock;
use Televixo\Persistence\Db;

defined( 'ABSPATH' ) || exit;

final class RateLimiter {

	/**
	 * Records a hit and reports whether the caller is still within the limit.
	 */
	public static function hit( string $scope, string $subject, int $limit, int $window_seconds ): bool {
		$window = intdiv( Clock::now(), $window_seconds ) * $window_seconds;
		$bucket = hash( 'sha256', $scope . '|' . $subject );
		Db::exec(
			Db::prepare(
				'INSERT INTO {rate_limits} (bucket, window_start, hits) VALUES (%s, %d, 1) ON DUPLICATE KEY UPDATE hits = hits + 1',
				$bucket,
				$window
			)
		);
		$hits = (int) Db::var( Db::prepare( 'SELECT hits FROM {rate_limits} WHERE bucket = %s AND window_start = %d', $bucket, $window ) );
		return $hits <= $limit;
	}

	public static function purge( int $older_than_seconds = DAY_IN_SECONDS ): int {
		return Db::exec( Db::prepare( 'DELETE FROM {rate_limits} WHERE window_start < %d', Clock::now() - $older_than_seconds ) );
	}
}
