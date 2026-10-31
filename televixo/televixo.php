<?php
/**
 * Plugin Name:       Televixo – Telegram Live Chat for WordPress
 * Plugin URI:        https://pdthemes.de
 * Description:       Self-hosted live chat. Visitors chat on your site; operators answer in Telegram or the WordPress inbox.
 * Version:           1.0.0
 * Requires at least: 6.7
 * Requires PHP:      8.2
 * Author:            pdthemes
 * Author URI:        https://pdthemes.de
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       televixo
 * Domain Path:       /languages
 *
 * @package Televixo
 * @author  pdthemes <https://pdthemes.de>
 * @copyright 2026 pdthemes
 */

defined( 'ABSPATH' ) || exit;

define( 'TELEVIXO_VERSION', '1.0.0' );
define( 'TELEVIXO_FILE', __FILE__ );
define( 'TELEVIXO_DIR', __DIR__ . '/' );
define( 'TELEVIXO_MIN_PHP', '8.2' );
define( 'TELEVIXO_MIN_WP', '6.7' );

/*
 * The requirements check must parse on old PHP versions, so this file only
 * uses syntax available since PHP 5.6 and loads the namespaced code after the
 * check succeeds.
 */
if ( version_compare( PHP_VERSION, TELEVIXO_MIN_PHP, '<' ) || version_compare( get_bloginfo( 'version' ), TELEVIXO_MIN_WP, '<' ) ) {
	add_action(
		'admin_notices',
		function () {
			if ( ! current_user_can( 'activate_plugins' ) ) {
				return;
			}
			printf(
				'<div class="notice notice-error"><p>%s</p></div>',
				esc_html(
					sprintf(
						/* translators: 1: required PHP version, 2: required WordPress version, 3: current PHP version, 4: current WordPress version. */
						__( 'Televixo requires PHP %1$s+ and WordPress %2$s+. This site runs PHP %3$s and WordPress %4$s. Televixo is inactive until the server is upgraded.', 'televixo' ),
						TELEVIXO_MIN_PHP,
						TELEVIXO_MIN_WP,
						PHP_VERSION,
						get_bloginfo( 'version' )
					)
				)
			);
		}
	);
	return;
}

require_once TELEVIXO_DIR . 'includes/Autoloader.php';
\Televixo\Autoloader::register();

register_activation_hook( __FILE__, array( '\Televixo\Core\Lifecycle', 'activate' ) );
register_deactivation_hook( __FILE__, array( '\Televixo\Core\Lifecycle', 'deactivate' ) );

add_action( 'plugins_loaded', array( '\Televixo\Core\Plugin', 'boot' ) );
