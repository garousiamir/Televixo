<?php
/**
 * Public widget configuration and request context.
 *
 * public_config() contains no secrets and nothing user-specific, so it is
 * safe inside full-page-cached HTML. Anything per-visitor (session, login
 * state, roles, cart) is only returned by no-store REST responses.
 *
 * @package Televixo
 */

namespace Televixo\Widget;

use Televixo\Automation\KnowledgeBase;
use Televixo\Core\Settings;
use Televixo\Rules\Repository as Rules;
use Televixo\Security\FileInspector;

defined( 'ABSPATH' ) || exit;

final class Config {

	/**
	 * @return array<string,mixed>
	 */
	public static function public_config(): array {
		$s     = Settings::all();
		$w     = $s['widget'];
		$types = $s['uploads']['types'];
		if ( $s['uploads']['voice'] ) {
			$types = array_merge( $types, array( 'ogg', 'mp3', 'm4a' ) );
		}
		$avatar = $w['avatar_id'] ? wp_get_attachment_image_url( (int) $w['avatar_id'], 'thumbnail' ) : '';
		return array(
			'version'        => TELEVIXO_VERSION,
			'rest'           => esc_url_raw( rest_url( 'televixo/v1/' ) ),
			'enabled'        => (bool) $w['enabled'],
			'locale'         => determine_locale(),
			'rtl'            => is_rtl(),
			'appearance'     => array(
				'position'        => $w['position'],
				'offset_x'        => $w['offset_x'],
				'offset_y'        => $w['offset_y'],
				'mobile_offset_x' => $w['mobile_offset_x'],
				'mobile_offset_y' => $w['mobile_offset_y'],
				'size'            => $w['size'],
				'mobile_size'     => $w['mobile_size'],
				'variant'         => $w['variant'],
				'icon'            => $w['icon'],
				'custom_icon'     => $w['custom_icon_svg'],
				'avatar'          => $avatar ? esc_url_raw( $avatar ) : '',
				'accent'          => $w['accent'],
				'z_index'         => $w['z_index'],
				'entrance'        => $w['entrance_animation'],
				'attention'       => $w['attention_animation'],
				'avoid_selectors' => array_values( array_filter( explode( "\n", (string) $w['avoid_selectors'] ) ) ),
				'sound'           => $w['sound'],
				'notifications'   => $w['browser_notifications'],
			),
			'texts'          => array(
				'label'    => '' !== $w['label'] ? $w['label'] : __( 'Chat with us', 'televixo' ),
				'title'    => '' !== $w['title'] ? $w['title'] : get_bloginfo( 'name' ),
				'subtitle' => $w['subtitle'],
				'greeting' => $w['greeting'],
				'offline'  => '' !== $s['offline']['message'] ? $s['offline']['message'] : __( 'We are offline right now. Leave a message and we will get back to you by email.', 'televixo' ),
				'away'     => '' !== $s['hours']['away_message'] ? $s['hours']['away_message'] : __( 'We are away for a moment. Your message will be answered as soon as possible.', 'televixo' ),
				'consent'  => $s['prechat']['consent_text'],
			),
			'greeting'       => array(
				'bubble' => $w['greeting_bubble'] && '' !== $w['greeting'],
				'delay'  => $w['greeting_delay'],
			),
			'prechat'        => array(
				'enabled'       => $s['prechat']['enabled'],
				'name'          => $s['prechat']['name'],
				'email'         => $s['prechat']['email'],
				'phone'         => $s['prechat']['phone'],
				'department'    => $s['prechat']['department'],
				'consent'       => $s['prechat']['consent'],
				'departments'   => array_map(
					static fn( $d ) => array(
						'key'   => $d['key'],
						'label' => $d['label'],
					),
					$s['prechat']['departments']
				),
				'custom_fields' => $s['prechat']['custom_fields'],
			),
			'offline'        => array( 'behavior' => $s['offline']['behavior'] ),
			'hours'          => array(
				'enabled'  => $s['hours']['enabled'],
				'timezone' => \Televixo\Domain\Availability::timezone()->getName(),
				'weekly'   => $s['hours']['weekly'],
				'holidays' => array_column( $s['hours']['holidays'], 'date' ),
			),
			'uploads'        => array(
				'enabled' => $s['uploads']['enabled'],
				'max_mb'  => $s['uploads']['max_mb'],
				'accept'  => array_values( array_intersect( $types, array_keys( FileInspector::ALLOWED ) ) ),
				'voice'   => $s['uploads']['voice'],
			),
			'csat'           => $s['csat'],
			'transcript'     => $s['privacy']['transcript_download'],
			'suggestions'    => $w['suggestions'],
			'kb'             => $w['show_kb'] ? KnowledgeBase::suggested() : array(),
			'kb_search'      => $w['show_kb'] && KnowledgeBase::count() > 0,
			'excluded_paths' => array_values( array_filter( explode( "\n", (string) $w['excluded_paths'] ) ) ),
			'rules'          => Rules::public_rules(),
			'limits'         => array( 'max_chars' => $s['limits']['max_message_chars'] ),
		);
	}

	/**
	 * Per-visitor context, returned only by no-store responses.
	 *
	 * @return array<string,mixed>
	 */
	public static function session_context( int $wp_user_id ): array {
		$user = $wp_user_id ? get_userdata( $wp_user_id ) : null;
		$ctx  = array(
			'logged_in' => (bool) $user,
			'roles'     => $user ? array_values( (array) $user->roles ) : array(),
		);
		if ( class_exists( 'WooCommerce' ) && function_exists( 'WC' ) ) {
			try {
				if ( function_exists( 'wc_load_cart' ) && null === WC()->cart ) {
					wc_load_cart();
				}
				$cart = WC()->cart;
				if ( $cart ) {
					$ctx['cart_items'] = (int) $cart->get_cart_contents_count();
					$ctx['cart_total'] = (float) $cart->get_cart_contents_total() + (float) $cart->get_cart_contents_tax();
				}
			} catch ( \Throwable $e ) {
				// Cart unavailable in this request; conditions on it evaluate false.
				unset( $ctx['cart_items'], $ctx['cart_total'] );
			}
		}
		return $ctx;
	}

	/**
	 * Page context sent by the widget when a conversation starts. Only the
	 * path is kept (no query string), the referrer is reduced to its host,
	 * and only standard UTM keys are retained.
	 *
	 * @param array<string,mixed> $in
	 * @return array<string,mixed>
	 */
	public static function sanitize_context( array $in ): array {
		$path = (string) ( $in['page_path'] ?? '' );
		$path = (string) wp_parse_url( $path, PHP_URL_PATH );
		$out  = array(
			'page_path'     => mb_substr( '/' . ltrim( sanitize_text_field( $path ), '/' ), 0, 200 ),
			'page_title'    => mb_substr( sanitize_text_field( (string) ( $in['page_title'] ?? '' ) ), 0, 120 ),
			'referrer_host' => '',
			'utm'           => array(),
			'locale'        => substr( sanitize_text_field( (string) ( $in['locale'] ?? '' ) ), 0, 20 ),
			'device'        => in_array( $in['device'] ?? '', array( 'desktop', 'tablet', 'mobile' ), true ) ? $in['device'] : '',
			'post_id'       => absint( $in['post_id'] ?? 0 ),
		);
		$ref  = (string) ( $in['referrer'] ?? '' );
		if ( '' !== $ref ) {
			$host                 = (string) wp_parse_url( $ref, PHP_URL_HOST );
			$out['referrer_host'] = preg_match( '/^[a-z0-9.-]{1,190}$/i', $host ) ? strtolower( $host ) : '';
		}
		foreach ( array( 'source', 'medium', 'campaign' ) as $k ) {
			if ( ! empty( $in['utm'][ $k ] ) && is_scalar( $in['utm'][ $k ] ) ) {
				$out['utm'][ $k ] = mb_substr( sanitize_text_field( (string) $in['utm'][ $k ] ), 0, 60 );
			}
		}
		return $out;
	}
}
