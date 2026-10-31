<?php
/**
 * Activation and deactivation. Deactivation stops scheduled work and keeps
 * all data; deletion only happens in uninstall.php when the administrator
 * explicitly opted in.
 *
 * @package Televixo
 */

namespace Televixo\Core;

use Televixo\Persistence\Migrator;
use Televixo\Queue\Scheduler;
use Televixo\Security\Capabilities;
use Televixo\Security\Secrets;

defined( 'ABSPATH' ) || exit;

final class Lifecycle {

	public static function activate( bool $network_wide = false ): void {
		$problems = Requirements::problems();
		if ( $problems ) {
			deactivate_plugins( plugin_basename( TELEVIXO_FILE ) );
			wp_die(
				esc_html( implode( ' ', $problems ) ),
				esc_html__( 'Televixo cannot be activated', 'televixo' ),
				array( 'back_link' => true )
			);
		}
		if ( is_multisite() && $network_wide ) {
			foreach ( get_sites(
				array(
					'fields' => 'ids',
					'number' => 1000,
				)
			) as $site_id ) {
				switch_to_blog( (int) $site_id );
				self::activate_site();
				restore_current_blog();
			}
			return;
		}
		self::activate_site();
	}

	public static function activate_site(): void {
		Migrator::migrate();
		Capabilities::install();
		Secrets::install_id();
		Secrets::webhook_secret();
		add_filter( 'cron_schedules', array( Scheduler::class, 'schedules' ) ); // phpcs:ignore WordPress.WP.CronInterval.CronSchedulesInterval
		Scheduler::ensure_events();
		if ( false === get_option( Settings::OPTION ) ) {
			add_option( Settings::OPTION, Settings::defaults(), '', true );
		}
		update_option( 'televixo_version', TELEVIXO_VERSION, true );
	}

	public static function deactivate( bool $network_wide = false ): void {
		if ( is_multisite() && $network_wide ) {
			foreach ( get_sites(
				array(
					'fields' => 'ids',
					'number' => 1000,
				)
			) as $site_id ) {
				switch_to_blog( (int) $site_id );
				Scheduler::clear_events();
				restore_current_blog();
			}
			return;
		}
		Scheduler::clear_events();
	}
}
