<?php
/**
 * Rule definition schema (v1) and validation.
 *
 * {
 *   "conditions": Group,              // when the rule applies
 *   "exclusions": Group|null,         // matching exclusions veto the rule
 *   "actions":    [Action, ...],
 *   "frequency":  { per_page, per_session, per_visitor, cooldown_hours, expires_at },
 *   "stop":       { on_reply, on_typing, on_close, on_human, if_opened }
 * }
 * Group     = { "op": "and"|"or", "negate": bool, "items": [Condition|Group] }
 * Condition = { "type": string, "operator": string, "value": mixed }
 *
 * @package Televixo
 */

namespace Televixo\Rules;

defined( 'ABSPATH' ) || exit;

final class Schema {

	public const MAX_DEPTH = 4;
	public const MAX_ITEMS = 30;

	/**
	 * type => [operators, value kind, evaluated where]
	 */
	public const CONDITIONS = array(
		'site'               => array( array( 'is' ), 'none', 'page' ),
		'page_id'            => array( array( 'in', 'not_in' ), 'ints', 'page' ),
		'post_type'          => array( array( 'in', 'not_in' ), 'keys', 'page' ),
		'template'           => array( array( 'in', 'not_in' ), 'strings', 'page' ),
		'term'               => array( array( 'in', 'not_in' ), 'terms', 'page' ),
		'page_kind'          => array( array( 'in', 'not_in' ), 'enum:front,home,archive,search,404,singular', 'page' ),
		'url'                => array( array( 'equals', 'wildcard', 'contains', 'not_wildcard' ), 'string', 'client' ),
		'query'              => array( array( 'exists', 'not_exists', 'equals' ), 'kv', 'client' ),
		'logged_in'          => array( array( 'is' ), 'bool', 'session' ),
		'role'               => array( array( 'in', 'not_in' ), 'keys', 'session' ),
		'device'             => array( array( 'in' ), 'enum:desktop,tablet,mobile', 'client' ),
		'viewport_width'     => array( array( 'gte', 'lte' ), 'number', 'client' ),
		'language'           => array( array( 'in', 'not_in' ), 'strings', 'page' ),
		'visitor_type'       => array( array( 'is' ), 'enum:new,returning', 'client' ),
		'referrer_host'      => array( array( 'equals', 'contains', 'empty' ), 'string', 'client' ),
		'utm_source'         => array( array( 'equals', 'contains' ), 'string', 'client' ),
		'utm_medium'         => array( array( 'equals', 'contains' ), 'string', 'client' ),
		'utm_campaign'       => array( array( 'equals', 'contains' ), 'string', 'client' ),
		'business_hours'     => array( array( 'is' ), 'enum:open,closed', 'client' ),
		'availability'       => array( array( 'in' ), 'enum:online,offline,away,closed,scheduled', 'session' ),
		'woo_page'           => array( array( 'in', 'not_in' ), 'enum:shop,product,cart,checkout,account', 'page' ),
		'woo_product'        => array( array( 'in', 'not_in' ), 'ints', 'page' ),
		'woo_category'       => array( array( 'in', 'not_in' ), 'ints', 'page' ),
		'cart_value'         => array( array( 'gte', 'lte' ), 'number', 'session' ),
		'cart_items'         => array( array( 'gte', 'lte' ), 'number', 'session' ),
		'time_on_page'       => array( array( 'gte' ), 'number', 'behavior' ),
		'scroll_depth'       => array( array( 'gte' ), 'number', 'behavior' ),
		'inactivity'         => array( array( 'gte' ), 'number', 'behavior' ),
		'exit_intent'        => array( array( 'is' ), 'bool', 'behavior' ),
		'trigger_seen'       => array( array( 'within_hours', 'not_within_hours' ), 'seen', 'client' ),
		'conversation_state' => array( array( 'in' ), 'enum:none,active,closed', 'session' ),
		'chat_opened'        => array( array( 'is' ), 'bool', 'client' ),
	);

	public const ACTIONS = array( 'launcher', 'teaser', 'open_chat', 'auto_message', 'department', 'greeting' );

	/**
	 * @param mixed $def
	 * @return array{ok:bool,errors:string[],definition:array<string,mixed>}
	 */
	public static function validate( $def ): array {
		$errors = array();
		if ( ! is_array( $def ) ) {
			return array(
				'ok'         => false,
				'errors'     => array( 'definition must be an object' ),
				'definition' => array(),
			);
		}
		$out               = array();
		$out['conditions'] = self::group(
			$def['conditions'] ?? array(
				'op'    => 'and',
				'items' => array(
					array(
						'type'     => 'site',
						'operator' => 'is',
					),
				),
			),
			1,
			'conditions',
			$errors
		);
		$out['exclusions'] = isset( $def['exclusions'] ) && is_array( $def['exclusions'] ) && ! empty( $def['exclusions']['items'] ) ? self::group( $def['exclusions'], 1, 'exclusions', $errors ) : null;
		$out['actions']    = array();
		foreach ( array_slice( (array) ( $def['actions'] ?? array() ), 0, 6 ) as $i => $a ) {
			$type = (string) ( $a['type'] ?? '' );
			if ( ! in_array( $type, self::ACTIONS, true ) ) {
				$errors[] = "actions[$i]: unknown action";
				continue;
			}
			$clean = array( 'type' => $type );
			switch ( $type ) {
				case 'launcher':
					$clean['visible'] = (bool) ( $a['visible'] ?? true );
					break;
				case 'teaser':
				case 'auto_message':
				case 'greeting':
					$clean['text'] = mb_substr( sanitize_textarea_field( (string) ( $a['text'] ?? '' ) ), 0, 300 );
					if ( '' === $clean['text'] ) {
						$errors[] = "actions[$i]: text is required";
					}
					break;
				case 'department':
					$clean['key'] = sanitize_key( (string) ( $a['key'] ?? '' ) );
					break;
			}
			$out['actions'][] = $clean;
		}
		if ( ! $out['actions'] ) {
			$errors[] = 'at least one action is required';
		}
		$f                = (array) ( $def['frequency'] ?? array() );
		$out['frequency'] = array(
			'per_page'       => self::opt_int( $f['per_page'] ?? 1, 1, 10 ),
			'per_session'    => self::opt_int( $f['per_session'] ?? null, 1, 100 ),
			'per_visitor'    => self::opt_int( $f['per_visitor'] ?? null, 1, 1000 ),
			'cooldown_hours' => self::opt_int( $f['cooldown_hours'] ?? null, 0, 8760 ),
			'expires_at'     => isset( $f['expires_at'] ) && preg_match( '/^\d{4}-\d{2}-\d{2}$/', (string) $f['expires_at'] ) ? (string) $f['expires_at'] : null,
		);
		$s                = (array) ( $def['stop'] ?? array() );
		$out['stop']      = array();
		foreach ( array( 'on_reply', 'on_typing', 'on_close', 'on_human', 'if_opened' ) as $k ) {
			$out['stop'][ $k ] = (bool) ( $s[ $k ] ?? true );
		}
		return array(
			'ok'         => ! $errors,
			'errors'     => $errors,
			'definition' => $out,
		);
	}

	/**
	 * @param mixed    $g
	 * @param string[] $errors
	 * @return array<string,mixed>
	 */
	private static function group( $g, int $depth, string $path, array &$errors ): array {
		if ( ! is_array( $g ) ) {
			$errors[] = "$path: group must be an object";
			return array(
				'op'     => 'and',
				'negate' => false,
				'items'  => array(),
			);
		}
		if ( $depth > self::MAX_DEPTH ) {
			$errors[] = "$path: nesting too deep";
			return array(
				'op'     => 'and',
				'negate' => false,
				'items'  => array(),
			);
		}
		$op    = 'or' === ( $g['op'] ?? 'and' ) ? 'or' : 'and';
		$items = array();
		$raw   = (array) ( $g['items'] ?? array() );
		if ( count( $raw ) > self::MAX_ITEMS ) {
			$errors[] = "$path: too many items";
		}
		foreach ( array_slice( $raw, 0, self::MAX_ITEMS ) as $i => $item ) {
			if ( is_array( $item ) && isset( $item['items'] ) ) {
				$items[] = self::group( $item, $depth + 1, "$path.items[$i]", $errors );
			} else {
				$c = self::condition( $item, "$path.items[$i]", $errors );
				if ( $c ) {
					$items[] = $c;
				}
			}
		}
		if ( ! $items ) {
			$errors[] = "$path: group is empty";
		}
		return array(
			'op'     => $op,
			'negate' => ! empty( $g['negate'] ),
			'items'  => $items,
		);
	}

	/**
	 * @param mixed    $c
	 * @param string[] $errors
	 * @return array<string,mixed>|null
	 */
	private static function condition( $c, string $path, array &$errors ): ?array {
		$type = is_array( $c ) ? (string) ( $c['type'] ?? '' ) : '';
		if ( ! isset( self::CONDITIONS[ $type ] ) ) {
			$errors[] = "$path: unknown condition type";
			return null;
		}
		[ $ops, $kind ] = self::CONDITIONS[ $type ];
		$op             = (string) ( $c['operator'] ?? $ops[0] );
		if ( ! in_array( $op, $ops, true ) ) {
			$errors[] = "$path: unsupported operator for $type";
			return null;
		}
		$v = $c['value'] ?? null;
		switch ( true ) {
			case 'none' === $kind:
				$v = true;
				break;
			case 'ints' === $kind:
				$v = array_slice( array_values( array_filter( array_map( 'absint', (array) $v ) ) ), 0, 200 );
				break;
			case 'keys' === $kind:
				$v = array_slice( array_values( array_filter( array_map( 'sanitize_key', (array) $v ) ) ), 0, 50 );
				break;
			case 'strings' === $kind:
				$v = array_slice( array_values( array_filter( array_map( static fn( $s ) => mb_substr( sanitize_text_field( (string) $s ), 0, 100 ), (array) $v ) ) ), 0, 50 );
				break;
			case 'terms' === $kind:
				$v = array_slice( array_values( array_filter( (array) $v, static fn( $s ) => (bool) preg_match( '/^[a-z0-9_-]{1,32}:\d{1,20}$/', (string) $s ) ) ), 0, 100 );
				break;
			case str_starts_with( $kind, 'enum:' ):
				$allowed = explode( ',', substr( $kind, 5 ) );
				$v       = is_array( $v ) ? array_values( array_intersect( $v, $allowed ) ) : ( in_array( $v, $allowed, true ) ? $v : null );
				if ( null === $v || array() === $v ) {
					$errors[] = "$path: invalid value";
					return null;
				}
				break;
			case 'string' === $kind:
				$v = mb_substr( sanitize_text_field( (string) $v ), 0, 200 );
				if ( in_array( $op, array( 'wildcard', 'not_wildcard' ), true ) && ( ! str_starts_with( $v, '/' ) || substr_count( $v, '*' ) > 5 ) ) {
					$errors[] = "$path: wildcard must start with / and contain at most 5 *";
					return null;
				}
				break;
			case 'number' === $kind:
				$v = is_numeric( $v ) ? max( 0, min( 1000000, (float) $v ) ) : 0;
				break;
			case 'bool' === $kind:
				$v = (bool) $v;
				break;
			case 'kv' === $kind:
				$v = array(
					'key'   => mb_substr( preg_replace( '/[^A-Za-z0-9_.\-\[\]]/', '', (string) ( $v['key'] ?? '' ) ) ?? '', 0, 60 ),
					'value' => mb_substr( sanitize_text_field( (string) ( $v['value'] ?? '' ) ), 0, 100 ),
				);
				if ( '' === $v['key'] ) {
					$errors[] = "$path: query key required";
					return null;
				}
				break;
			case 'seen' === $kind:
				$v = array(
					'rule'  => absint( $v['rule'] ?? 0 ),
					'hours' => max( 1, min( 8760, absint( $v['hours'] ?? 24 ) ) ),
				);
				break;
		}
		return array(
			'type'     => $type,
			'operator' => $op,
			'value'    => $v,
		);
	}

	/**
	 * @param mixed $v
	 */
	private static function opt_int( $v, int $min, int $max ): ?int {
		if ( null === $v || '' === $v ) {
			return null;
		}
		return max( $min, min( $max, (int) $v ) );
	}
}
