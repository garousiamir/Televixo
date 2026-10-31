<?php
/**
 * Connection health flags surfaced in diagnostics and admin notices.
 *
 * @package Televixo
 */

namespace Televixo\Telegram;

use Televixo\Core\Clock;

defined( 'ABSPATH' ) || exit;

final class Health {

	public const OPTION = 'televixo_health';

	public static function flag( string $area, string $code ): void {
		$all          = self::all();
		$all[ $area ] = array( 'code' => $code, 'at' => Clock::mysql() );
		update_option( self::OPTION, $all, false );
	}

	public static function clear( string $area ): void {
		$all = self::all();
		if ( isset( $all[ $area ] ) ) {
			unset( $all[ $area ] );
			update_option( self::OPTION, $all, false );
		}
	}

	/**
	 * @return array<string,array{code:string,at:string}>
	 */
	public static function all(): array {
		$v = get_option( self::OPTION, array() );
		return is_array( $v ) ? $v : array();
	}

	public static function mark_webhook_seen(): void {
		update_option( 'televixo_webhook_last_seen', Clock::mysql(), false );
	}
}
