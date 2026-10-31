<?php
/**
 * Front-end bootstrap. On excluded paths nothing is enqueued. Otherwise a
 * single deferred script (plus its stylesheet, injected into a shadow root)
 * is loaded with cache-safe, non-personal configuration and page context.
 *
 * @package Televixo
 */

namespace Televixo\Widget;

use Televixo\Core\Settings;
use Televixo\Rules\Engine;

defined( 'ABSPATH' ) || exit;

final class Frontend {

	public static function register(): void {
		add_action( 'wp_enqueue_scripts', array( self::class, 'enqueue' ) );
	}

	public static function should_load(): bool {
		if ( is_admin() || ! Settings::get( 'widget.enabled', true ) || wp_doing_ajax() || is_feed() || is_embed() ) {
			return false;
		}
		$path = Engine::normalize_path( isset( $_SERVER['REQUEST_URI'] ) ? (string) wp_unslash( $_SERVER['REQUEST_URI'] ) : '/' ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- normalized and only compared.
		foreach ( array_filter( explode( "\n", (string) Settings::get( 'widget.excluded_paths', '' ) ) ) as $pattern ) {
			if ( Engine::wildcard( trim( $pattern ), $path ) ) {
				return false;
			}
		}
		return (bool) apply_filters( 'televixo_load_widget', true );
	}

	public static function enqueue(): void {
		if ( ! self::should_load() ) {
			return;
		}
		$asset = TELEVIXO_DIR . 'assets/build/widget.asset.php';
		$meta  = is_readable( $asset ) ? require $asset : array( 'version' => TELEVIXO_VERSION, 'dependencies' => array() );
		$url   = plugins_url( 'assets/build/', TELEVIXO_FILE );
		wp_register_script( 'televixo-widget', $url . 'widget.js', array(), $meta['version'], array( 'strategy' => 'defer', 'in_footer' => true ) );
		$boot = array(
			'config'  => Config::public_config(),
			'page'    => self::page_context(),
			'css'     => $url . 'widget.css?ver=' . rawurlencode( (string) $meta['version'] ),
			'i18n'    => Strings::widget(),
		);
		wp_add_inline_script( 'televixo-widget', 'window.televixoBoot=' . wp_json_encode( $boot, JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_UNICODE ) . ';', 'before' );
		wp_enqueue_script( 'televixo-widget' );
	}

	/**
	 * Page facts derived from the URL being rendered (identical for every
	 * visitor of this URL, so cache-safe).
	 *
	 * @return array<string,mixed>
	 */
	public static function page_context(): array {
		$obj   = get_queried_object();
		$kinds = array();
		if ( is_front_page() ) {
			$kinds[] = 'front';
		}
		if ( is_home() ) {
			$kinds[] = 'home';
		}
		if ( is_archive() ) {
			$kinds[] = 'archive';
		}
		if ( is_search() ) {
			$kinds[] = 'search';
		}
		if ( is_404() ) {
			$kinds[] = '404';
		}
		if ( is_singular() ) {
			$kinds[] = 'singular';
		}
		$ctx = array(
			'page_id'    => is_singular() ? (int) get_queried_object_id() : 0,
			'post_type'  => is_singular() ? array( (string) get_post_type() ) : array(),
			'template'   => is_singular() ? array( (string) get_page_template_slug( get_queried_object_id() ) ) : array(),
			'terms'      => array(),
			'page_kinds' => $kinds,
			'language'   => array( determine_locale() ),
			'woo_page'   => array(),
			'product_id' => 0,
			'product_cats' => array(),
		);
		if ( is_singular() && $obj instanceof \WP_Post ) {
			foreach ( get_object_taxonomies( $obj->post_type ) as $tax ) {
				$terms = get_the_terms( $obj, $tax );
				if ( is_array( $terms ) ) {
					foreach ( array_slice( $terms, 0, 50 ) as $t ) {
						$ctx['terms'][] = $tax . ':' . $t->term_id;
					}
				}
			}
		} elseif ( $obj instanceof \WP_Term ) {
			$ctx['terms'][] = $obj->taxonomy . ':' . $obj->term_id;
		}
		if ( function_exists( 'is_woocommerce' ) ) {
			foreach ( array( 'shop' => 'is_shop', 'product' => 'is_product', 'cart' => 'is_cart', 'checkout' => 'is_checkout', 'account' => 'is_account_page' ) as $key => $fn ) {
				if ( function_exists( $fn ) && $fn() ) {
					$ctx['woo_page'][] = $key;
				}
			}
			if ( function_exists( 'is_product' ) && is_product() ) {
				$ctx['product_id']   = (int) get_queried_object_id();
				$ctx['product_cats'] = array_map( 'intval', wp_get_post_terms( $ctx['product_id'], 'product_cat', array( 'fields' => 'ids' ) ) ?: array() );
			} elseif ( function_exists( 'is_product_category' ) && is_product_category() && $obj instanceof \WP_Term ) {
				$ctx['product_cats'] = array( (int) $obj->term_id );
			}
		}
		return $ctx;
	}
}
