<?php
/**
 * Provider registry. Third parties may register additional providers with
 * the `televixo_providers` filter.
 *
 * @package Televixo
 */

namespace Televixo\Provider;

use Televixo\Telegram\TelegramProvider;

defined( 'ABSPATH' ) || exit;

final class Registry {

	/** @var ProviderInterface[]|null */
	private static ?array $providers = null;

	/**
	 * @return ProviderInterface[]
	 */
	public static function all(): array {
		if ( null === self::$providers ) {
			$list = apply_filters( 'televixo_providers', array( 'telegram' => new TelegramProvider() ) );
			self::$providers = array_filter( (array) $list, static fn( $p ) => $p instanceof ProviderInterface );
		}
		return self::$providers;
	}

	public static function get( string $key ): ?ProviderInterface {
		return self::all()[ $key ] ?? null;
	}

	public static function for_job( string $type ): ?ProviderInterface {
		foreach ( self::all() as $provider ) {
			if ( $provider->handles( $type ) ) {
				return $provider;
			}
		}
		return null;
	}

	public static function reset(): void {
		self::$providers = null;
	}
}
