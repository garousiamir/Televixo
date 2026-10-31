<?php
/**
 * E2E-only helpers. Loaded as an MU-plugin on the throwaway test site,
 * never shipped. Simulates the Telegram Bot API and exposes recorded calls.
 * Mock-provider E2E proves our integration logic, not Telegram itself.
 */

if ( ! defined( 'TELEVIXO_E2E' ) || ! TELEVIXO_E2E ) {
	return;
}

add_filter(
	'pre_http_request',
	static function ( $pre, $args, $url ) {
		if ( 'api.telegram.org' !== wp_parse_url( $url, PHP_URL_HOST ) ) {
			return $pre;
		}
		preg_match( '#/bot[^/]+/(\w+)$#', $url, $m );
		$method = $m[1] ?? '';
		$params = json_decode( (string) ( $args['body'] ?? '' ), true ) ?: array();
		if ( isset( $args['headers']['Content-Type'] ) && str_starts_with( $args['headers']['Content-Type'], 'multipart' ) ) {
			preg_match_all( '/name="(chat_id|caption|message_thread_id)"\r\n\r\n([^\r]*)/', (string) $args['body'], $mm, PREG_SET_ORDER );
			foreach ( $mm as $x ) {
				$params[ $x[1] ] = $x[2];
			}
			$params['_file'] = true;
		}
		$calls   = get_option( 'tvx_e2e_calls', array() );
		$calls[] = array( 'method' => $method, 'params' => $params );
		update_option( 'tvx_e2e_calls', $calls, false );
		$next = (int) get_option( 'tvx_e2e_next', 1000 ) + 1;
		update_option( 'tvx_e2e_next', $next, false );
		$result = match ( $method ) {
			'getMe'            => array( 'id' => 123456789, 'is_bot' => true, 'first_name' => 'Chio care', 'username' => 'chio_care_bot', 'can_join_groups' => true, 'can_read_all_group_messages' => false ),
			'createForumTopic' => array( 'message_thread_id' => $next ),
			'getChat'          => array( 'id' => $params['chat_id'] ?? 0, 'type' => 'supergroup', 'title' => 'Chio support', 'is_forum' => true ),
			'getChatMember'    => array( 'status' => 'administrator', 'can_manage_topics' => true ),
			'getWebhookInfo'   => array( 'url' => '', 'pending_update_count' => 0 ),
			default            => array( 'message_id' => $next, 'chat' => array( 'id' => $params['chat_id'] ?? 0 ), 'date' => time() ),
		};
		return array(
			'headers'  => array( 'content-type' => 'application/json' ),
			'body'     => wp_json_encode( array( 'ok' => true, 'result' => $result ) ),
			'response' => array( 'code' => 200, 'message' => 'OK' ),
			'cookies'  => array(),
		);
	},
	10,
	3
);

add_action(
	'rest_api_init',
	static function () {
		register_rest_route(
			'tvx-e2e/v1',
			'/calls',
			array(
				'methods'             => array( 'GET', 'DELETE' ),
				'permission_callback' => '__return_true',
				'callback'            => static function ( WP_REST_Request $r ) {
					if ( 'DELETE' === $r->get_method() ) {
						delete_option( 'tvx_e2e_calls' );
						return array( 'ok' => true );
					}
					return get_option( 'tvx_e2e_calls', array() );
				},
			)
		);
		register_rest_route(
			'tvx-e2e/v1',
			'/worker',
			array(
				'methods'             => 'POST',
				'permission_callback' => '__return_true',
				'callback'            => static fn() => \Televixo\Queue\Worker::run( 5.0 ),
			)
		);
	}
);

// Locale switch for RTL tests: ?tvx_locale=fa_IR (cookie-persisted).
add_filter(
	'locale',
	static function ( $locale ) {
		$want = isset( $_GET['tvx_locale'] ) ? sanitize_text_field( wp_unslash( $_GET['tvx_locale'] ) ) : ( $_COOKIE['tvx_locale'] ?? '' ); // phpcs:ignore
		return 'fa_IR' === $want ? 'fa_IR' : $locale;
	}
);
add_action(
	'init',
	static function () {
		global $wp_locale;
		if ( 'fa_IR' === determine_locale() && $wp_locale ) {
			// No core Persian language pack is installed offline; force RTL so
			// the plugin's own fa_IR translation is exercised in an RTL page.
			$wp_locale->text_direction = 'rtl';
		}
	},
	0
);
