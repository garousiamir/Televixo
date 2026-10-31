<?php
/**
 * Admin menu and asset loading. Assets load only on Televixo screens.
 *
 * @package Televixo
 */

namespace Televixo\Admin;

use Televixo\Core\Settings;
use Televixo\Security\Capabilities as Caps;
use Televixo\Telegram\Health;

defined( 'ABSPATH' ) || exit;

final class Admin {

	public const SLUG = 'televixo';

	/** @var string[] */
	private static array $hooks = array();

	public static function register(): void {
		add_action( 'admin_menu', array( self::class, 'menu' ) );
		add_action( 'admin_enqueue_scripts', array( self::class, 'assets' ) );
		add_action( 'admin_notices', array( self::class, 'notices' ) );
		add_filter( 'plugin_action_links_' . plugin_basename( TELEVIXO_FILE ), array( self::class, 'links' ) );
		add_action( 'admin_post_televixo_dismiss_setup', array( self::class, 'dismiss_setup' ) );
	}

	/**
	 * @return array<string,array{0:string,1:string}> route => [title, capability]
	 */
	public static function screens(): array {
		return array(
			'inbox'      => array( __( 'Inbox', 'televixo' ), Caps::HANDLE_ASSIGNED ),
			'setup'      => array( __( 'Setup', 'televixo' ), Caps::MANAGE_SETTINGS ),
			'operators'  => array( __( 'Operators & teams', 'televixo' ), Caps::MANAGE_SETTINGS ),
			'appearance' => array( __( 'Widget', 'televixo' ), Caps::MANAGE_SETTINGS ),
			'rules'      => array( __( 'Targeting', 'televixo' ), Caps::MANAGE_SETTINGS ),
			'content'    => array( __( 'Replies & FAQ', 'televixo' ), Caps::MANAGE_SETTINGS ),
			'settings'   => array( __( 'Settings', 'televixo' ), Caps::MANAGE_SETTINGS ),
			'reports'    => array( __( 'Reports', 'televixo' ), Caps::VIEW_REPORTS ),
			'queue'      => array( __( 'Delivery & health', 'televixo' ), Caps::MANAGE_SETTINGS ),
		);
	}

	public static function menu(): void {
		$cap           = current_user_can( Caps::HANDLE_ASSIGNED ) ? Caps::HANDLE_ASSIGNED : Caps::VIEW_ALL;
		self::$hooks[] = (string) add_menu_page( __( 'Televixo', 'televixo' ), __( 'Televixo', 'televixo' ), $cap, self::SLUG, array( self::class, 'render' ), 'dashicons-format-chat', 26 );
		foreach ( self::screens() as $route => [ $title, $screen_cap ] ) {
			$slug          = 'inbox' === $route ? self::SLUG : self::SLUG . '-' . $route;
			$screen_cap    = 'inbox' === $route ? $cap : $screen_cap;
			self::$hooks[] = (string) add_submenu_page( self::SLUG, $title, $title, $screen_cap, $slug, array( self::class, 'render' ) );
		}
	}

	public static function render(): void {
		$page  = isset( $_GET['page'] ) ? sanitize_key( wp_unslash( $_GET['page'] ) ) : self::SLUG; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- routing only.
		$route = self::SLUG === $page ? 'inbox' : substr( $page, strlen( self::SLUG ) + 1 );
		printf( '<div class="wrap televixo-admin-wrap"><div id="televixo-admin" data-route="%s"><p class="televixo-loading">%s</p></div><noscript>%s</noscript></div>', esc_attr( $route ), esc_html__( 'Loading…', 'televixo' ), esc_html__( 'Televixo needs JavaScript in the admin area.', 'televixo' ) );
	}

	public static function assets( string $hook ): void {
		if ( ! in_array( $hook, self::$hooks, true ) ) {
			return;
		}
		$asset = TELEVIXO_DIR . 'assets/build/admin.asset.php';
		$meta  = is_readable( $asset ) ? require $asset : array(
			'dependencies' => array( 'wp-element', 'wp-api-fetch', 'wp-i18n' ),
			'version'      => TELEVIXO_VERSION,
		);
		$url   = plugins_url( 'assets/build/', TELEVIXO_FILE );
		wp_enqueue_style( 'televixo-admin', $url . 'admin.css', array(), $meta['version'] );
		wp_enqueue_script( 'televixo-admin', $url . 'admin.js', $meta['dependencies'], $meta['version'], true );
		wp_set_script_translations( 'televixo-admin', 'televixo', TELEVIXO_DIR . 'languages' );
		wp_enqueue_media();
		wp_add_inline_script(
			'televixo-admin',
			'window.televixoAdmin=' . wp_json_encode(
				array(
					'adminUrl'      => admin_url( 'admin.php' ),
					'restUrl'       => esc_url_raw( rest_url( 'televixo/v1/' ) ),
					'nonce'         => wp_create_nonce( 'wp_rest' ),
					'webhookUrl'    => esc_url_raw( rest_url( 'televixo/v1/telegram/webhook' ) ),
					'version'       => TELEVIXO_VERSION,
					'caps'          => array_values( array_filter( Caps::ALL, 'current_user_can' ) ),
					'userId'        => get_current_user_id(),
					'timezone'      => wp_timezone_string(),
					'locale'        => determine_locale(),
					'rtl'           => is_rtl(),
					'widgetPreview' => array(
						'script' => $url . 'widget.js?ver=' . rawurlencode( (string) $meta['version'] ),
						'css'    => $url . 'widget.css?ver=' . rawurlencode( (string) $meta['version'] ),
						'i18n'   => \Televixo\Widget\Strings::widget(),
					),
					'woocommerce'   => class_exists( 'WooCommerce' ),
				),
				JSON_HEX_TAG | JSON_HEX_AMP
			) . ';',
			'before'
		);
	}

	public static function notices(): void {
		if ( ! current_user_can( Caps::MANAGE_SETTINGS ) ) {
			return;
		}
		$health = Health::all();
		if ( '' === (string) Settings::get( 'telegram.bot_id' ) ) {
			$screen = get_current_screen();
			if ( ( $screen && str_contains( (string) $screen->id, 'televixo' ) ) || get_user_meta( get_current_user_id(), 'televixo_setup_notice_dismissed', true ) ) {
				return;
			}
			printf(
				'<div class="notice notice-info"><p>%s <a href="%s">%s</a> · <a href="%s">%s</a></p></div>',
				esc_html__( 'Televixo is installed. Connect a Telegram bot to start receiving chats.', 'televixo' ),
				esc_url( admin_url( 'admin.php?page=televixo-setup' ) ),
				esc_html__( 'Open setup', 'televixo' ),
				esc_url( wp_nonce_url( admin_url( 'admin-post.php?action=televixo_dismiss_setup' ), 'televixo_dismiss_setup' ) ),
				esc_html__( 'Dismiss', 'televixo' )
			);
			return;
		}
		if ( isset( $health['token'] ) || isset( $health['destination'] ) ) {
			printf(
				'<div class="notice notice-error"><p>%s <a href="%s">%s</a></p></div>',
				esc_html__( 'Televixo cannot deliver chats to Telegram right now (the bot token or destination needs attention).', 'televixo' ),
				esc_url( admin_url( 'admin.php?page=televixo-queue' ) ),
				esc_html__( 'View diagnostics', 'televixo' )
			);
		}
	}

	/**
	 * Remembers that the current user dismissed the setup notice.
	 */
	public static function dismiss_setup(): void {
		check_admin_referer( 'televixo_dismiss_setup' );
		if ( current_user_can( Caps::MANAGE_SETTINGS ) ) {
			update_user_meta( get_current_user_id(), 'televixo_setup_notice_dismissed', 1 );
		}
		wp_safe_redirect( wp_get_referer() ?: admin_url() );
		exit;
	}

	/**
	 * @param string[] $links
	 * @return string[]
	 */
	public static function links( array $links ): array {
		array_unshift( $links, sprintf( '<a href="%s">%s</a>', esc_url( admin_url( 'admin.php?page=televixo-setup' ) ), esc_html__( 'Setup', 'televixo' ) ) );
		return $links;
	}
}
