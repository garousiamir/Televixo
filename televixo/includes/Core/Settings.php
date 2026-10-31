<?php
/**
 * Plugin settings: defaults, typed access and strict sanitization.
 *
 * Secrets are not stored here; see Security\Secrets.
 *
 * @package Televixo
 */

namespace Televixo\Core;

defined( 'ABSPATH' ) || exit;

final class Settings {

	public const OPTION = 'televixo_settings';

	/** @var array<string,mixed>|null */
	private static ?array $cache = null;

	/**
	 * @return array<string,mixed>
	 */
	public static function defaults(): array {
		return array(
			'telegram'   => array(
				'bot_id'                  => '',
				'bot_username'            => '',
				'routing_mode'            => 'reply',
				'destination_chat_id'     => '',
				'destination_title'       => '',
				'destination_type'        => '',
				'allowed_chat_ids'        => array(),
				'context_fields'          => array( 'name', 'page' ),
				'topic_forwarding'        => 'operator_messages',
				'note_prefix'             => '#note',
				'auto_claim_on_reply'     => true,
				'uncertain_policy'        => 'hold',
				'recreate_deleted_topics' => true,
				'webhook_url'             => '',
				'webhook_owner'           => '',
			),
			'routing'    => array(
				'strategy'        => 'manual',
				'default_team_id' => 0,
			),
			'widget'     => array(
				'enabled'               => true,
				'position'              => 'end',
				'offset_x'              => 24,
				'offset_y'              => 24,
				'mobile_offset_x'       => 16,
				'mobile_offset_y'       => 16,
				'size'                  => 56,
				'mobile_size'           => 52,
				'variant'               => 'pill',
				'label'                 => '',
				'icon'                  => 'chat',
				'custom_icon_svg'       => '',
				'avatar_id'             => 0,
				'title'                 => '',
				'subtitle'              => '',
				'greeting'              => '',
				'greeting_bubble'       => false,
				'greeting_delay'        => 4,
				'entrance_animation'    => true,
				'attention_animation'   => false,
				'z_index'               => 9990,
				'avoid_selectors'       => '',
				'sound'                 => false,
				'browser_notifications' => false,
				'suggestions'           => array(),
				'show_kb'               => true,
				'excluded_paths'        => '',
				'accent'                => '#1c1c1c',
			),
			'prechat'    => array(
				'enabled'       => false,
				'name'          => 'optional',
				'email'         => 'optional',
				'phone'         => 'hidden',
				'department'    => 'hidden',
				'consent'       => 'hidden',
				'consent_text'  => '',
				'departments'   => array(),
				'custom_fields' => array(),
			),
			'offline'    => array(
				'behavior'     => 'form',
				'message'      => '',
				'notify_email' => '',
			),
			'hours'      => array(
				'enabled'           => false,
				'timezone'          => '',
				'weekly'            => array(
					'mon' => array( array( '09:00', '17:00' ) ),
					'tue' => array( array( '09:00', '17:00' ) ),
					'wed' => array( array( '09:00', '17:00' ) ),
					'thu' => array( array( '09:00', '17:00' ) ),
					'fri' => array( array( '09:00', '17:00' ) ),
					'sat' => array(),
					'sun' => array(),
				),
				'holidays'          => array(),
				'away'              => false,
				'away_message'      => '',
				'presence_required' => true,
			),
			'uploads'    => array(
				'enabled'                   => true,
				'max_mb'                    => 10,
				'types'                     => array( 'jpg', 'png', 'gif', 'webp', 'pdf', 'txt' ),
				'voice'                     => false,
				'quota_per_conversation_mb' => 50,
			),
			'csat'       => array(
				'enabled' => true,
				'comment' => true,
			),
			'automation' => array(
				'welcome_enabled' => false,
				'welcome_message' => '',
				'welcome_options' => array(),
			),
			'privacy'    => array(
				'retention_days'       => 365,
				'event_retention_days' => 365,
				'delete_on_uninstall'  => false,
				'trusted_proxies'      => array(),
				'transcript_download'  => true,
			),
			'limits'     => array(
				'messages_per_minute' => 20,
				'sessions_per_hour'   => 20,
				'uploads_per_hour'    => 20,
				'max_message_chars'   => 4000,
			),
		);
	}

	/**
	 * @return array<string,mixed>
	 */
	public static function all(): array {
		if ( null === self::$cache ) {
			$stored      = get_option( self::OPTION, array() );
			self::$cache = self::merge( self::defaults(), is_array( $stored ) ? $stored : array() );
		}
		return self::$cache;
	}

	/**
	 * Dot-path accessor, e.g. get( 'widget.position' ).
	 *
	 * @param mixed $fallback
	 * @return mixed
	 */
	public static function get( string $path, $fallback = null ) {
		$value = self::all();
		foreach ( explode( '.', $path ) as $key ) {
			if ( ! is_array( $value ) || ! array_key_exists( $key, $value ) ) {
				return $fallback;
			}
			$value = $value[ $key ];
		}
		return $value;
	}

	/**
	 * Sanitizes and persists a partial update.
	 *
	 * @param array<string,mixed> $input
	 * @return array<string,mixed> Saved settings.
	 */
	public static function update( array $input ): array {
		$merged = self::merge( self::all(), $input );
		$clean  = self::sanitize( $merged );
		update_option( self::OPTION, $clean, true );
		self::$cache = null;
		return self::all();
	}

	/**
	 * Updates internal values (bot identity etc.) without user input paths.
	 *
	 * @param mixed $value
	 */
	public static function set_internal( string $path, $value ): void {
		$all = self::all();
		$ref = &$all;
		foreach ( explode( '.', $path ) as $key ) {
			if ( ! isset( $ref[ $key ] ) || ! is_array( $ref ) ) {
				$ref[ $key ] = array();
			}
			$ref = &$ref[ $key ];
		}
		$ref = $value;
		unset( $ref );
		update_option( self::OPTION, self::sanitize( $all ), true );
		self::$cache = null;
	}

	public static function flush(): void {
		self::$cache = null;
	}

	/**
	 * Merges only keys known to the defaults tree; lists are replaced whole.
	 *
	 * @param array<string,mixed> $base
	 * @param array<string,mixed> $over
	 * @return array<string,mixed>
	 */
	private static function merge( array $base, array $over ): array {
		foreach ( $base as $key => $value ) {
			if ( ! array_key_exists( $key, $over ) ) {
				continue;
			}
			if ( is_array( $value ) && self::is_assoc( $value ) && is_array( $over[ $key ] ) ) {
				$base[ $key ] = self::merge( $value, $over[ $key ] );
			} else {
				$base[ $key ] = $over[ $key ];
			}
		}
		return $base;
	}

	/**
	 * @param array<mixed> $a
	 */
	private static function is_assoc( array $a ): bool {
		return array() !== $a && array_keys( $a ) !== range( 0, count( $a ) - 1 );
	}

	/**
	 * @param array<string,mixed> $s
	 * @return array<string,mixed>
	 */
	public static function sanitize( array $s ): array {
		$d   = self::defaults();
		$out = $d;

		$t                                      = (array) $s['telegram'];
		$out['telegram']['bot_id']              = self::provider_id( $t['bot_id'] ?? '' );
		$out['telegram']['bot_username']        = preg_replace( '/[^A-Za-z0-9_]/', '', (string) ( $t['bot_username'] ?? '' ) );
		$out['telegram']['routing_mode']        = self::choice( $t['routing_mode'] ?? '', array( 'reply', 'topics' ), 'reply' );
		$out['telegram']['destination_chat_id'] = self::provider_id( $t['destination_chat_id'] ?? '' );
		$out['telegram']['destination_title']   = sanitize_text_field( (string) ( $t['destination_title'] ?? '' ) );
		$out['telegram']['destination_type']    = self::choice( $t['destination_type'] ?? '', array( '', 'private', 'group', 'supergroup' ), '' );
		$out['telegram']['allowed_chat_ids']    = array_values( array_filter( array_map( array( self::class, 'provider_id' ), (array) ( $t['allowed_chat_ids'] ?? array() ) ) ) );
		$out['telegram']['context_fields']      = array_values( array_intersect( (array) ( $t['context_fields'] ?? array() ), array( 'name', 'email', 'phone', 'page', 'department', 'referrer' ) ) );
		$out['telegram']['topic_forwarding']    = self::choice( $t['topic_forwarding'] ?? '', array( 'operator_messages', 'replies_only' ), 'operator_messages' );
		$out['telegram']['note_prefix']         = mb_substr( sanitize_text_field( (string) ( $t['note_prefix'] ?? '#note' ) ), 0, 16 );
		$out['telegram']['auto_claim_on_reply'] = (bool) ( $t['auto_claim_on_reply'] ?? true );
		$out['telegram']['uncertain_policy']    = self::choice( $t['uncertain_policy'] ?? '', array( 'hold', 'retry' ), 'hold' );
		$out['telegram']['recreate_deleted_topics'] = (bool) ( $t['recreate_deleted_topics'] ?? true );
		$out['telegram']['webhook_url']             = esc_url_raw( (string) ( $t['webhook_url'] ?? '' ), array( 'https' ) );
		$out['telegram']['webhook_owner']           = preg_replace( '/[^a-z0-9]/', '', (string) ( $t['webhook_owner'] ?? '' ) );

		$r                                 = (array) $s['routing'];
		$out['routing']['strategy']        = self::choice( $r['strategy'] ?? '', array( 'manual', 'round_robin', 'load' ), 'manual' );
		$out['routing']['default_team_id'] = absint( $r['default_team_id'] ?? 0 );

		$w             = (array) $s['widget'];
		$o             = &$out['widget'];
		$o['enabled']  = (bool) ( $w['enabled'] ?? true );
		$o['position'] = self::choice( $w['position'] ?? '', array( 'end', 'start', 'left', 'right' ), 'end' );
		foreach ( array( 'offset_x', 'offset_y', 'mobile_offset_x', 'mobile_offset_y' ) as $k ) {
			$o[ $k ] = self::int_range( $w[ $k ] ?? $d['widget'][ $k ], 0, 200 );
		}
		$o['size']            = self::int_range( $w['size'] ?? 56, 40, 80 );
		$o['mobile_size']     = self::int_range( $w['mobile_size'] ?? 52, 40, 72 );
		$o['variant']         = self::choice( $w['variant'] ?? '', array( 'circle', 'pill' ), 'pill' );
		$o['label']           = mb_substr( sanitize_text_field( (string) ( $w['label'] ?? '' ) ), 0, 40 );
		$o['icon']            = self::choice( $w['icon'] ?? '', array( 'chat', 'discuss', 'help', 'mail', 'custom' ), 'chat' );
		$o['custom_icon_svg'] = \Televixo\Security\SvgSanitizer::sanitize_icon( (string) ( $w['custom_icon_svg'] ?? '' ) );
		if ( 'custom' === $o['icon'] && '' === $o['custom_icon_svg'] ) {
			$o['icon'] = 'chat';
		}
		$o['avatar_id']             = absint( $w['avatar_id'] ?? 0 );
		$o['title']                 = mb_substr( sanitize_text_field( (string) ( $w['title'] ?? '' ) ), 0, 60 );
		$o['subtitle']              = mb_substr( sanitize_text_field( (string) ( $w['subtitle'] ?? '' ) ), 0, 90 );
		$o['greeting']              = mb_substr( sanitize_textarea_field( (string) ( $w['greeting'] ?? '' ) ), 0, 300 );
		$o['greeting_bubble']       = (bool) ( $w['greeting_bubble'] ?? false );
		$o['greeting_delay']        = self::int_range( $w['greeting_delay'] ?? 4, 0, 600 );
		$o['entrance_animation']    = (bool) ( $w['entrance_animation'] ?? true );
		$o['attention_animation']   = (bool) ( $w['attention_animation'] ?? false );
		$o['z_index']               = self::int_range( $w['z_index'] ?? 9990, 1, 999999 );
		$o['avoid_selectors']       = self::selector_list( (string) ( $w['avoid_selectors'] ?? '' ) );
		$o['sound']                 = (bool) ( $w['sound'] ?? false );
		$o['browser_notifications'] = (bool) ( $w['browser_notifications'] ?? false );
		$o['suggestions']           = array_slice( array_values( array_filter( array_map( static fn( $v ) => mb_substr( sanitize_text_field( (string) $v ), 0, 60 ), (array) ( $w['suggestions'] ?? array() ) ) ) ), 0, 6 );
		$o['show_kb']               = (bool) ( $w['show_kb'] ?? true );
		$o['excluded_paths']        = self::path_list( (string) ( $w['excluded_paths'] ?? '' ) );
		$o['accent']                = sanitize_hex_color( (string) ( $w['accent'] ?? '' ) ) ?: '#1c1c1c';
		unset( $o );

		$p                         = (array) $s['prechat'];
		$out['prechat']['enabled'] = (bool) ( $p['enabled'] ?? false );
		foreach ( array( 'name', 'email', 'phone', 'department', 'consent' ) as $f ) {
			$out['prechat'][ $f ] = self::choice( $p[ $f ] ?? '', array( 'hidden', 'optional', 'required' ), $d['prechat'][ $f ] );
		}
		$out['prechat']['consent_text'] = wp_kses( (string) ( $p['consent_text'] ?? '' ), array( 'a' => array( 'href' => true ) ) );
		$out['prechat']['departments']  = array();
		foreach ( array_slice( (array) ( $p['departments'] ?? array() ), 0, 20 ) as $dep ) {
			$key = sanitize_key( (string) ( $dep['key'] ?? '' ) );
			if ( '' !== $key ) {
				$out['prechat']['departments'][] = array(
					'key'     => $key,
					'label'   => mb_substr( sanitize_text_field( (string) ( $dep['label'] ?? $key ) ), 0, 60 ),
					'team_id' => absint( $dep['team_id'] ?? 0 ),
				);
			}
		}
		$out['prechat']['custom_fields'] = array();
		foreach ( array_slice( (array) ( $p['custom_fields'] ?? array() ), 0, 10 ) as $cf ) {
			$key = sanitize_key( (string) ( $cf['key'] ?? '' ) );
			if ( '' !== $key && ! in_array( $key, array( 'name', 'email', 'phone', 'department', 'consent' ), true ) ) {
				$out['prechat']['custom_fields'][] = array(
					'key'      => $key,
					'label'    => mb_substr( sanitize_text_field( (string) ( $cf['label'] ?? $key ) ), 0, 60 ),
					'type'     => self::choice( $cf['type'] ?? '', array( 'text', 'textarea', 'select' ), 'text' ),
					'options'  => array_slice( array_values( array_filter( array_map( 'sanitize_text_field', (array) ( $cf['options'] ?? array() ) ) ) ), 0, 20 ),
					'required' => (bool) ( $cf['required'] ?? false ),
				);
			}
		}

		$of                             = (array) $s['offline'];
		$out['offline']['behavior']     = self::choice( $of['behavior'] ?? '', array( 'form', 'accept', 'hide' ), 'form' );
		$out['offline']['message']      = mb_substr( sanitize_textarea_field( (string) ( $of['message'] ?? '' ) ), 0, 300 );
		$out['offline']['notify_email'] = sanitize_email( (string) ( $of['notify_email'] ?? '' ) );

		$h                        = (array) $s['hours'];
		$out['hours']['enabled']  = (bool) ( $h['enabled'] ?? false );
		$tz                       = (string) ( $h['timezone'] ?? '' );
		$out['hours']['timezone'] = in_array( $tz, timezone_identifiers_list(), true ) ? $tz : '';
		foreach ( array_keys( $d['hours']['weekly'] ) as $day ) {
			$ranges = array();
			foreach ( array_slice( (array) ( $h['weekly'][ $day ] ?? array() ), 0, 4 ) as $range ) {
				$from = self::hhmm( $range[0] ?? '' );
				$to   = self::hhmm( $range[1] ?? '' );
				if ( $from && $to && $from < $to ) {
					$ranges[] = array( $from, $to );
				}
			}
			$out['hours']['weekly'][ $day ] = $ranges;
		}
		$out['hours']['holidays'] = array();
		foreach ( array_slice( (array) ( $h['holidays'] ?? array() ), 0, 100 ) as $hol ) {
			$date = (string) ( $hol['date'] ?? '' );
			if ( preg_match( '/^\d{4}-\d{2}-\d{2}$/', $date ) ) {
				$out['hours']['holidays'][] = array(
					'date'  => $date,
					'label' => mb_substr( sanitize_text_field( (string) ( $hol['label'] ?? '' ) ), 0, 60 ),
				);
			}
		}
		$out['hours']['away']              = (bool) ( $h['away'] ?? false );
		$out['hours']['away_message']      = mb_substr( sanitize_textarea_field( (string) ( $h['away_message'] ?? '' ) ), 0, 300 );
		$out['hours']['presence_required'] = (bool) ( $h['presence_required'] ?? true );

		$u                         = (array) $s['uploads'];
		$out['uploads']['enabled'] = (bool) ( $u['enabled'] ?? true );
		$out['uploads']['max_mb']  = self::int_range( $u['max_mb'] ?? 10, 1, 20 );
		$out['uploads']['types']   = array_values( array_intersect( (array) ( $u['types'] ?? array() ), array_keys( \Televixo\Security\FileInspector::ALLOWED ) ) );
		$out['uploads']['voice']   = (bool) ( $u['voice'] ?? false );
		$out['uploads']['quota_per_conversation_mb'] = self::int_range( $u['quota_per_conversation_mb'] ?? 50, 1, 500 );

		$out['csat']['enabled'] = (bool) ( $s['csat']['enabled'] ?? true );
		$out['csat']['comment'] = (bool) ( $s['csat']['comment'] ?? true );

		$a                                    = (array) $s['automation'];
		$out['automation']['welcome_enabled'] = (bool) ( $a['welcome_enabled'] ?? false );
		$out['automation']['welcome_message'] = mb_substr( sanitize_textarea_field( (string) ( $a['welcome_message'] ?? '' ) ), 0, 500 );
		$out['automation']['welcome_options'] = array();
		foreach ( array_slice( (array) ( $a['welcome_options'] ?? array() ), 0, 6 ) as $opt ) {
			$label = mb_substr( sanitize_text_field( (string) ( $opt['label'] ?? '' ) ), 0, 60 );
			if ( '' !== $label ) {
				$out['automation']['welcome_options'][] = array(
					'label'   => $label,
					'reply'   => mb_substr( sanitize_textarea_field( (string) ( $opt['reply'] ?? '' ) ), 0, 1000 ),
					'handoff' => (bool) ( $opt['handoff'] ?? false ),
				);
			}
		}

		$pr                                     = (array) $s['privacy'];
		$out['privacy']['retention_days']       = self::int_range( $pr['retention_days'] ?? 365, 0, 3650 );
		$out['privacy']['event_retention_days'] = self::int_range( $pr['event_retention_days'] ?? 365, 7, 3650 );
		$out['privacy']['delete_on_uninstall']  = (bool) ( $pr['delete_on_uninstall'] ?? false );
		$out['privacy']['transcript_download']  = (bool) ( $pr['transcript_download'] ?? true );
		$out['privacy']['trusted_proxies']      = array_values(
			array_filter(
				array_map( 'trim', (array) ( $pr['trusted_proxies'] ?? array() ) ),
				static fn( $v ) => \Televixo\Security\ClientIp::valid_cidr( (string) $v )
			)
		);

		$l                                    = (array) $s['limits'];
		$out['limits']['messages_per_minute'] = self::int_range( $l['messages_per_minute'] ?? 20, 1, 120 );
		$out['limits']['sessions_per_hour']   = self::int_range( $l['sessions_per_hour'] ?? 20, 1, 500 );
		$out['limits']['uploads_per_hour']    = self::int_range( $l['uploads_per_hour'] ?? 20, 1, 200 );
		$out['limits']['max_message_chars']   = self::int_range( $l['max_message_chars'] ?? 4000, 100, 20000 );

		return $out;
	}

	/**
	 * Telegram identifiers: optional minus sign and up to 20 digits.
	 *
	 * @param mixed $v
	 */
	public static function provider_id( $v ): string {
		$v = trim( (string) $v );
		return preg_match( '/^-?\d{1,20}$/', $v ) ? $v : '';
	}

	/**
	 * @param mixed    $v
	 * @param string[] $allowed
	 */
	private static function choice( $v, array $allowed, string $fallback ): string {
		return in_array( $v, $allowed, true ) ? (string) $v : $fallback;
	}

	/**
	 * @param mixed $v
	 */
	private static function int_range( $v, int $min, int $max ): int {
		return max( $min, min( $max, (int) $v ) );
	}

	/**
	 * @param mixed $v
	 */
	private static function hhmm( $v ): string {
		$v = (string) $v;
		if ( '24:00' === $v ) {
			return $v;
		}
		return preg_match( '/^([01]\d|2[0-3]):[0-5]\d$/', $v ) ? $v : '';
	}

	private static function selector_list( string $v ): string {
		$lines = array_filter( array_map( 'trim', preg_split( '/[\r\n,]+/', $v ) ?: array() ) );
		$safe  = array_filter( $lines, static fn( $l ) => (bool) preg_match( '/^[A-Za-z0-9_\-#.\[\]=\'" :>~*+()]{1,120}$/', $l ) );
		return implode( "\n", array_slice( $safe, 0, 20 ) );
	}

	private static function path_list( string $v ): string {
		$lines = array_filter( array_map( 'trim', preg_split( '/[\r\n]+/', $v ) ?: array() ) );
		$safe  = array_filter( $lines, static fn( $l ) => str_starts_with( $l, '/' ) && strlen( $l ) <= 200 && ! preg_match( '/[\s<>"]/', $l ) );
		return implode( "\n", array_slice( $safe, 0, 100 ) );
	}
}
