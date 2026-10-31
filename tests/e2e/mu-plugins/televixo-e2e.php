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
		$latency = (int) get_option( 'tvx_e2e_latency', 0 );
		if ( $latency ) {
			usleep( $latency * 1000 ); // Simulated network latency for race tests.
		}
		// Append atomically so concurrent workers cannot lose recorded calls.
		global $wpdb;
		$wpdb->query( $wpdb->prepare( "INSERT INTO {$wpdb->prefix}tvx_e2e_calls (method, params) VALUES (%s, %s)", $method, wp_json_encode( $params ) ) );
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
					return tvx_e2e_calls( 'DELETE' === $r->get_method() );
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

function tvx_e2e_calls( bool $reset = false ): array {
	global $wpdb;
	$t = $wpdb->prefix . 'tvx_e2e_calls';
	$wpdb->query( "CREATE TABLE IF NOT EXISTS $t (id bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY, method varchar(40) NOT NULL, params longtext NOT NULL)" ); // phpcs:ignore
	if ( $reset ) {
		$wpdb->query( "TRUNCATE $t" ); // phpcs:ignore
		return array();
	}
	return array_map( static fn( $r ) => array( 'method' => $r['method'], 'params' => json_decode( $r['params'], true ) ), $wpdb->get_results( "SELECT method, params FROM $t ORDER BY id", ARRAY_A ) ); // phpcs:ignore
}
add_action( 'init', static fn() => tvx_e2e_calls(), 1 );

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

// Query budget probe: ?tvx_queries=1 records plugin queries of this request.
if ( isset( $_GET['tvx_queries'] ) ) { // phpcs:ignore
	if ( ! defined( 'SAVEQUERIES' ) ) {
		define( 'SAVEQUERIES', true );
	}
	add_action(
		'shutdown',
		static function () {
			global $wpdb;
			$mine = array_values( array_filter( (array) $wpdb->queries, static fn( $q ) => str_contains( $q[0], 'televixo' ) ) );
			update_option( 'tvx_e2e_query_probe', array( 'total' => count( (array) $wpdb->queries ), 'televixo' => count( $mine ), 'sql' => array_map( static fn( $q ) => substr( $q[0], 0, 160 ), $mine ) ), false );
		},
		PHP_INT_MAX
	);
}
