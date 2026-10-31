<?php
/**
 * Composition root.
 *
 * @package Televixo
 */

namespace Televixo\Core;

use Televixo\Persistence\Migrator;
use Televixo\Queue\Scheduler;
use Televixo\Security\SessionManager;

defined( 'ABSPATH' ) || exit;

final class Plugin {

	private static bool $booted = false;

	public static function boot(): void {
		if ( self::$booted ) {
			return;
		}
		self::$booted = true;

		add_action( 'init', array( self::class, 'load_textdomain' ), 1 );
		if ( Migrator::needs_migration() ) {
			add_action( 'init', array( self::class, 'maybe_migrate' ), 2 );
		}
		Scheduler::register();
		add_action( 'init', array( Scheduler::class, 'ensure_events' ) );
		add_action( 'rest_api_init', array( self::class, 'register_routes' ) );
		add_action( 'wp_logout', array( self::class, 'on_logout' ) );

		\Televixo\Widget\Frontend::register();
		\Televixo\Privacy\PersonalData::register();
		if ( is_admin() ) {
			\Televixo\Admin\Admin::register();
		}
		if ( defined( 'WP_CLI' ) && WP_CLI ) {
			\WP_CLI::add_command( 'televixo', \Televixo\CLI\Command::class );
		}
	}

	public static function load_textdomain(): void {
		load_plugin_textdomain( 'televixo', false, dirname( plugin_basename( TELEVIXO_FILE ) ) . '/languages' );
	}

	public static function maybe_migrate(): void {
		Migrator::migrate();
		Lifecycle::activate_site();
	}

	public static function register_routes(): void {
		foreach ( array(
			new \Televixo\REST\PublicController(),
			new \Televixo\REST\WebhookController(),
			new \Televixo\REST\AdminController(),
			new \Televixo\REST\SetupController(),
		) as $controller ) {
			$controller->register();
		}
	}

	/**
	 * A WordPress logout ends the chat session in this browser so the next
	 * person on a shared device cannot read it.
	 */
	public static function on_logout(): void {
		$s = SessionManager::current();
		if ( $s ) {
			SessionManager::revoke( (int) $s['id'] );
		}
		SessionManager::clear_cookie();
	}
}
