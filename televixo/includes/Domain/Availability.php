<?php
/**
 * Truthful availability.
 *
 *   away     – the global "temporarily away" switch is on
 *   closed   – business hours are enabled and now is outside them (or a
 *              holiday); `next_open` gives the next scheduled opening
 *   offline  – within hours (or hours disabled) but no operator is present
 *              (presence = explicit "online" plus a recent inbox heartbeat or
 *              an unexpired Telegram /online window)
 *   online   – at least one operator is present
 *
 * When presence is not required, `scheduled` is returned instead of
 * `online` during business hours so the widget never claims a person is
 * online based on a schedule alone.
 *
 * @package Televixo
 */

namespace Televixo\Domain;

use Televixo\Core\Clock;
use Televixo\Core\Settings;

defined( 'ABSPATH' ) || exit;

final class Availability {

	private const DAYS = array( 'sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat' );

	/**
	 * @return array{state:string,next_open:?string,operators_present:int,timezone:string}
	 */
	public static function status( ?int $team_id = null ): array {
		$h   = (array) Settings::get( 'hours' );
		$tz  = self::timezone();
		$out = array( 'state' => 'online', 'next_open' => null, 'operators_present' => 0, 'timezone' => $tz->getName() );
		if ( ! empty( $h['away'] ) ) {
			$out['state'] = 'away';
			return $out;
		}
		if ( ! empty( $h['enabled'] ) && ! self::is_open( Clock::now() ) ) {
			$out['state']     = 'closed';
			$next             = self::next_open( Clock::now() );
			$out['next_open'] = $next ? gmdate( 'c', $next ) : null;
			return $out;
		}
		$present                  = count( Operators::present( $team_id ) );
		$out['operators_present'] = $present;
		if ( $present > 0 ) {
			return $out;
		}
		$out['state'] = ! empty( $h['presence_required'] ) ? 'offline' : ( ! empty( $h['enabled'] ) ? 'scheduled' : 'offline' );
		return $out;
	}

	public static function timezone(): \DateTimeZone {
		$name = (string) Settings::get( 'hours.timezone', '' );
		try {
			return '' !== $name ? new \DateTimeZone( $name ) : wp_timezone();
		} catch ( \Exception $e ) {
			return wp_timezone();
		}
	}

	public static function is_open( int $ts ): bool {
		$tz  = self::timezone();
		$dt  = ( new \DateTimeImmutable( '@' . $ts ) )->setTimezone( $tz );
		$day = $dt->format( 'Y-m-d' );
		foreach ( (array) Settings::get( 'hours.holidays', array() ) as $hol ) {
			if ( ( $hol['date'] ?? '' ) === $day ) {
				return false;
			}
		}
		$key = self::DAYS[ (int) $dt->format( 'w' ) ];
		$now = $dt->format( 'H:i' );
		foreach ( (array) Settings::get( 'hours.weekly.' . $key, array() ) as $range ) {
			if ( $now >= $range[0] && $now < $range[1] ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Next opening within 14 days (DST-safe: computed in local wall time).
	 */
	public static function next_open( int $ts ): ?int {
		$tz       = self::timezone();
		$local    = ( new \DateTimeImmutable( '@' . $ts ) )->setTimezone( $tz );
		$holidays = array_column( (array) Settings::get( 'hours.holidays', array() ), 'date' );
		for ( $i = 0; $i < 14; $i++ ) {
			$day = $local->modify( "+$i day" );
			if ( in_array( $day->format( 'Y-m-d' ), $holidays, true ) ) {
				continue;
			}
			$key = self::DAYS[ (int) $day->format( 'w' ) ];
			foreach ( (array) Settings::get( 'hours.weekly.' . $key, array() ) as $range ) {
				[ $hh, $mm ] = array_map( 'intval', explode( ':', $range[0] ) );
				$open = $day->setTime( $hh, $mm );
				if ( $open->getTimestamp() > $ts ) {
					return $open->getTimestamp();
				}
			}
		}
		return null;
	}
}
