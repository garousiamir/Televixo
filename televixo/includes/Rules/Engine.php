<?php
/**
 * Rule evaluation with an explanation trace ("why this rule matched").
 *
 * The browser evaluates rules at runtime (assets-src/widget/rules.ts) because
 * page HTML may be cached and behavioural signals only exist client-side.
 * This PHP implementation is the reference used for admin previews and
 * validation; both implementations run the same vectors in
 * tests/fixtures/rule-vectors.json.
 *
 * Precedence (docs/targeting.md):
 *   1. Global excluded paths suppress the widget entirely.
 *   2. A rule whose exclusions match never applies.
 *   3. Rules are ordered by priority (higher first), then ID (lower first).
 *   4. Each action slot (launcher, attention, department, greeting) is taken
 *      by the first matching rule in that order. "attention" covers teaser,
 *      open_chat and auto_message: one per page view.
 *   5. For launcher visibility at equal priority, hide wins over show.
 *
 * @package Televixo
 */

namespace Televixo\Rules;

defined( 'ABSPATH' ) || exit;

final class Engine {

	/**
	 * @param array<string,mixed> $ctx
	 * @return array{matched:bool,trace:array<int,array<string,mixed>>}
	 */
	public static function evaluate( array $rule_def, array $ctx, int $rule_id = 0 ): array {
		$trace = array();
		if ( ! empty( $rule_def['frequency']['expires_at'] ) && ( $ctx['today'] ?? gmdate( 'Y-m-d' ) ) > $rule_def['frequency']['expires_at'] ) {
			return array(
				'matched' => false,
				'trace'   => array( array( 'expired' => true ) ),
			);
		}
		if ( ! empty( $rule_def['exclusions'] ) ) {
			$ex = self::group( $rule_def['exclusions'], $ctx, $rule_id, $trace, 'exclusions' );
			if ( $ex ) {
				return array(
					'matched' => false,
					'trace'   => $trace,
				);
			}
		}
		$ok = self::group( $rule_def['conditions'], $ctx, $rule_id, $trace, 'conditions' );
		return array(
			'matched' => $ok,
			'trace'   => $trace,
		);
	}

	/**
	 * @param array<int,array<string,mixed>> $trace
	 */
	private static function group( array $g, array $ctx, int $rule_id, array &$trace, string $path ): bool {
		$results = array();
		foreach ( $g['items'] as $i => $item ) {
			$p         = "$path.$i";
			$results[] = isset( $item['items'] )
				? self::group( $item, $ctx, $rule_id, $trace, $p )
				: self::condition( $item, $ctx, $rule_id, $trace, $p );
		}
		$v = 'or' === $g['op'] ? in_array( true, $results, true ) : ! in_array( false, $results, true );
		if ( ! empty( $g['negate'] ) ) {
			$v = ! $v;
		}
		$trace[] = array(
			'path'   => $path,
			'group'  => $g['op'],
			'negate' => ! empty( $g['negate'] ),
			'result' => $v,
		);
		return $v;
	}

	/**
	 * @param array<int,array<string,mixed>> $trace
	 */
	private static function condition( array $c, array $ctx, int $rule_id, array &$trace, string $path ): bool {
		$v       = self::test( $c, $ctx, $rule_id );
		$trace[] = array(
			'path'     => $path,
			'type'     => $c['type'],
			'operator' => $c['operator'],
			'value'    => $c['value'],
			'actual'   => self::actual( $c['type'], $ctx ),
			'result'   => $v,
		);
		return $v;
	}

	/**
	 * @return mixed
	 */
	private static function actual( string $type, array $ctx ) {
		return match ( $type ) {
			'utm_source', 'utm_medium', 'utm_campaign' => $ctx['utm'][ substr( $type, 4 ) ] ?? null,
			'url'     => $ctx['path'] ?? null,
			'query'   => $ctx['query'] ?? null,
			default   => $ctx[ $type ] ?? null,
		};
	}

	public static function test( array $c, array $ctx, int $rule_id = 0 ): bool {
		$op = $c['operator'];
		$v  = $c['value'];
		switch ( $c['type'] ) {
			case 'site':
				return true;
			case 'page_id':
			case 'woo_product':
				$actual = (int) ( $ctx[ 'page_id' === $c['type'] ? 'page_id' : 'product_id' ] ?? 0 );
				return self::in( $op, in_array( $actual, $v, true ) );
			case 'woo_category':
				return self::in( $op, (bool) array_intersect( array_map( 'intval', (array) ( $ctx['product_cats'] ?? array() ) ), $v ) );
			case 'post_type':
			case 'template':
			case 'language':
			case 'woo_page':
			case 'page_kind':
				$key    = array(
					'post_type' => 'post_type',
					'template'  => 'template',
					'language'  => 'language',
					'woo_page'  => 'woo_page',
					'page_kind' => 'page_kinds',
				)[ $c['type'] ];
				$actual = (array) ( $ctx[ $key ] ?? array() );
				return self::in( $op, (bool) array_intersect( array_map( 'strval', $actual ), array_map( 'strval', $v ) ) );
			case 'term':
				return self::in( $op, (bool) array_intersect( (array) ( $ctx['terms'] ?? array() ), $v ) );
			case 'role':
				return self::in( $op, (bool) array_intersect( (array) ( $ctx['roles'] ?? array() ), $v ) );
			case 'url':
				$path = self::normalize_path( (string) ( $ctx['path'] ?? '/' ) );
				return match ( $op ) {
					'equals'       => $path === self::normalize_path( (string) $v ),
					'contains'     => '' !== $v && str_contains( $path, strtolower( (string) $v ) ),
					'wildcard'     => self::wildcard( (string) $v, $path ),
					'not_wildcard' => ! self::wildcard( (string) $v, $path ),
					default        => false,
				};
			case 'query':
				$q = (array) ( $ctx['query'] ?? array() );
				return match ( $op ) {
					'exists'     => array_key_exists( $v['key'], $q ),
					'not_exists' => ! array_key_exists( $v['key'], $q ),
					'equals'     => isset( $q[ $v['key'] ] ) && (string) $q[ $v['key'] ] === $v['value'],
					default      => false,
				};
			case 'logged_in':
			case 'exit_intent':
			case 'chat_opened':
				return (bool) ( $ctx[ $c['type'] ] ?? false ) === (bool) $v;
			case 'device':
			case 'availability':
			case 'conversation_state':
				return in_array( (string) ( $ctx[ $c['type'] ] ?? '' ), (array) $v, true );
			case 'visitor_type':
			case 'business_hours':
				return (string) ( $ctx[ $c['type'] ] ?? '' ) === (string) $v;
			case 'viewport_width':
			case 'cart_value':
			case 'cart_items':
			case 'time_on_page':
			case 'scroll_depth':
			case 'inactivity':
				if ( ! isset( $ctx[ $c['type'] ] ) ) {
					return false;
				}
				$n = (float) $ctx[ $c['type'] ];
				return 'lte' === $op ? $n <= (float) $v : $n >= (float) $v;
			case 'referrer_host':
				$host = strtolower( (string) ( $ctx['referrer_host'] ?? '' ) );
				return match ( $op ) {
					'empty'    => '' === $host,
					'equals'   => $host === strtolower( (string) $v ),
					'contains' => '' !== $v && str_contains( $host, strtolower( (string) $v ) ),
					default    => false,
				};
			case 'utm_source':
			case 'utm_medium':
			case 'utm_campaign':
				$actual = strtolower( (string) ( $ctx['utm'][ substr( $c['type'], 4 ) ] ?? '' ) );
				return 'equals' === $op ? $actual === strtolower( (string) $v ) : ( '' !== $v && str_contains( $actual, strtolower( (string) $v ) ) );
			case 'trigger_seen':
				$rule = $v['rule'] ?: $rule_id;
				$last = (int) ( $ctx['seen'][ (string) $rule ] ?? 0 );
				$now  = (int) ( $ctx['now'] ?? time() );
				$seen = $last > 0 && $now - $last < $v['hours'] * 3600;
				return 'within_hours' === $op ? $seen : ! $seen;
		}
		return false;
	}

	private static function in( string $op, bool $hit ): bool {
		return 'not_in' === $op ? ! $hit : $hit;
	}

	public static function normalize_path( string $p ): string {
		$p = strtolower( rawurldecode( (string) ( wp_parse_url( $p, PHP_URL_PATH ) ?? '/' ) ) );
		$p = '/' . ltrim( $p, '/' );
		return strlen( $p ) > 1 ? rtrim( $p, '/' ) : $p;
	}

	/**
	 * Safe wildcard: only "*" is special (any characters, including "/").
	 * Everything else is matched literally; no user-supplied regex.
	 */
	public static function wildcard( string $pattern, string $path ): bool {
		$pattern = self::normalize_path( $pattern );
		$parts   = array_map( static fn( $s ) => preg_quote( $s, '#' ), explode( '*', $pattern ) );
		return (bool) preg_match( '#^' . implode( '.*', $parts ) . '$#', self::normalize_path( $path ) );
	}

	/**
	 * Resolves the effective actions for a set of rules on one page view.
	 *
	 * @param array<int,array{id:int,priority:int,definition:array<string,mixed>}> $rules
	 * @param array<string,mixed> $ctx
	 * @return array{actions:array<string,array<string,mixed>>,matched:int[],explain:array<int,array<string,mixed>>}
	 */
	public static function resolve( array $rules, array $ctx ): array {
		usort( $rules, static fn( $a, $b ) => ( $b['priority'] <=> $a['priority'] ) ?: ( $a['id'] <=> $b['id'] ) );
		$slots   = array();
		$matched = array();
		$explain = array();
		foreach ( $rules as $rule ) {
			$r         = self::evaluate( $rule['definition'], $ctx, (int) $rule['id'] );
			$explain[] = array(
				'rule'    => (int) $rule['id'],
				'matched' => $r['matched'],
				'trace'   => $r['trace'],
			);
			if ( ! $r['matched'] ) {
				continue;
			}
			$matched[] = (int) $rule['id'];
			foreach ( $rule['definition']['actions'] as $a ) {
				$slot = in_array( $a['type'], array( 'teaser', 'open_chat', 'auto_message' ), true ) ? 'attention' : $a['type'];
				if ( ! isset( $slots[ $slot ] ) ) {
					$slots[ $slot ] = $a + array(
						'rule'     => (int) $rule['id'],
						'priority' => (int) $rule['priority'],
					);
				} elseif ( 'launcher' === $slot && $slots[ $slot ]['priority'] === (int) $rule['priority'] && empty( $a['visible'] ) ) {
					$slots[ $slot ] = $a + array(
						'rule'     => (int) $rule['id'],
						'priority' => (int) $rule['priority'],
					);
				}
			}
		}
		return array(
			'actions' => $slots,
			'matched' => $matched,
			'explain' => $explain,
		);
	}
}
