<?php
/**
 * Uninstall. Data is deleted only if the administrator enabled
 * "Delete all data when the plugin is deleted"; the default preserves it.
 * The Telegram webhook is removed only if it still points at this site.
 *
 * @package Televixo
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

if ( version_compare( PHP_VERSION, '8.2', '<' ) ) {
	return;
}

require_once __DIR__ . '/includes/Autoloader.php';
\Televixo\Autoloader::register();
if ( ! defined( 'TELEVIXO_VERSION' ) ) {
	define( 'TELEVIXO_VERSION', '1.0.0' );
	define( 'TELEVIXO_FILE', __DIR__ . '/televixo.php' );
	define( 'TELEVIXO_DIR', __DIR__ . '/' );
}

/**
 * @return void
 */
function televixo_uninstall_site() {
	wp_clear_scheduled_hook( 'televixo_worker' );
	wp_clear_scheduled_hook( 'televixo_maintenance' );
	$settings = get_option( 'televixo_settings', array() );
	if ( empty( $settings['privacy']['delete_on_uninstall'] ) ) {
		return;
	}
	try {
		\Televixo\REST\SetupController::remove_owned_webhook( false );
	} catch ( \Throwable $e ) {
		// Network failure must not block uninstall; the webhook then simply fails.
		unset( $e );
	}
	$dir = \Televixo\Domain\Attachments::storage_dir();
	if ( ! defined( 'TELEVIXO_STORAGE_DIR' ) && is_dir( $dir ) ) {
		\Televixo\Core\Fs::rmdir( $dir, true );
	}
	\Televixo\Persistence\Migrator::drop_all();
	\Televixo\Security\Capabilities::uninstall();
	delete_metadata( 'user', 0, 'televixo_setup_notice_dismissed', '', true );
	foreach ( array( 'televixo_settings', 'televixo_secrets', 'televixo_install_id', 'televixo_storage_suffix', 'televixo_health', 'televixo_webhook_last_seen', 'televixo_worker_last_run', 'televixo_maintenance_last_run', 'televixo_blocked_networks', 'televixo_version', 'televixo_db_migrated_at' ) as $option ) {
		delete_option( $option );
	}
}

if ( is_multisite() ) {
	foreach ( get_sites(
		array(
			'fields' => 'ids',
			'number' => 1000,
		)
	) as $televixo_site ) {
		switch_to_blog( (int) $televixo_site );
		televixo_uninstall_site();
		restore_current_blog();
	}
} else {
	televixo_uninstall_site();
}
