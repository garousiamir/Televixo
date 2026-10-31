<?php
/**
 * Stateful fake of the Telegram Bot API, wired through WordPress's
 * pre_http_request filter. It records every call, assigns increasing
 * message IDs per chat, creates forum topics, and can inject failures.
 * Passing tests against this fake proves our logic, not Telegram's.
 */

namespace Televixo\Tests;

final class FakeTelegram {

	public const TOKEN = '123456789:AAHfakeTokenForTestsOnly_abcdefghijk';

	/** @var array<int,array{method:string,params:array<string,mixed>,files:bool}> */
	public array $calls = array();
	/** @var array<string,int> */
	private array $next_id = array();
	private int $next_thread = 500;
	/** @var array<int,callable|array<string,mixed>> Queue of injected responses. */
	public array $script = array();
	/** @var array<string,array<string,mixed>> */
	public array $chats = array();
	public string $webhook_url = '';
	public bool $read_all = false;

	public function __construct() {
		add_filter( 'pre_http_request', array( $this, 'intercept' ), 10, 3 );
		$this->chats['-1001000000001'] = array( 'id' => -1001000000001, 'type' => 'supergroup', 'title' => 'Support', 'is_forum' => false );
		$this->chats['-1001000000002'] = array( 'id' => -1001000000002, 'type' => 'supergroup', 'title' => 'Support Topics', 'is_forum' => true );
	}

	public function remove(): void {
		remove_filter( 'pre_http_request', array( $this, 'intercept' ), 10 );
	}

	/**
	 * Queue a failure (or custom response) for the next matching call.
	 *
	 * @param array<string,mixed>|string $response 'timeout' | 'network' | Bot API JSON body
	 */
	public function fail_next( string $method, $response, int $http = 400 ): void {
		$this->script[] = array( 'method' => $method, 'response' => $response, 'http' => $http );
	}

	public function count( string $method ): int {
		return count( array_filter( $this->calls, static fn( $c ) => $c['method'] === $method ) );
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public function sent( string $method = 'sendMessage' ): array {
		return array_values( array_map( static fn( $c ) => $c['params'], array_filter( $this->calls, static fn( $c ) => $c['method'] === $method ) ) );
	}

	/**
	 * @param false|array<string,mixed>|\WP_Error $pre
	 * @param array<string,mixed> $args
	 * @return false|array<string,mixed>|\WP_Error
	 */
	public function intercept( $pre, $args, $url ) {
		$host = (string) wp_parse_url( $url, PHP_URL_HOST );
		if ( 'api.telegram.org' !== $host ) {
			return $pre;
		}
		if ( ! preg_match( '#^https://api\.telegram\.org/(file/)?bot([^/]+)/(.+)$#', $url, $m ) ) {
			return $this->json( array( 'ok' => false, 'error_code' => 404, 'description' => 'Not Found' ), 404 );
		}
		if ( $m[1] ) {
			if ( ! empty( $args['filename'] ) ) {
				file_put_contents( $args['filename'], base64_decode( 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' ) );
			}
			return array( 'headers' => array(), 'body' => '', 'response' => array( 'code' => 200, 'message' => 'OK' ), 'cookies' => array(), 'filename' => $args['filename'] ?? null );
		}
		if ( self::TOKEN !== $m[2] ) {
			return $this->json( array( 'ok' => false, 'error_code' => 401, 'description' => 'Unauthorized' ), 401 );
		}
		$method = $m[3];
		$params = array();
		$files  = false;
		if ( isset( $args['headers']['Content-Type'] ) && str_starts_with( $args['headers']['Content-Type'], 'multipart/form-data' ) ) {
			$files = true;
			preg_match_all( '/name="([^"]+)"(?:; filename="[^"]*")?\r\nContent-Type: [^\r]+\r\n\r\n|name="([^"]+)"\r\n\r\n([^\r]*)\r\n/', (string) $args['body'], $mm, PREG_SET_ORDER );
			foreach ( $mm as $match ) {
				if ( ! empty( $match[3] ) ) {
					$params[ $match[3] ] = $match[4];
				}
			}
		} else {
			$params = json_decode( (string) $args['body'], true, 64, JSON_BIGINT_AS_STRING ) ?: array();
		}
		$this->calls[] = array( 'method' => $method, 'params' => $params, 'files' => $files );

		foreach ( $this->script as $i => $s ) {
			if ( $s['method'] === $method ) {
				unset( $this->script[ $i ] );
				if ( 'timeout' === $s['response'] ) {
					return new \WP_Error( 'http_request_failed', 'cURL error 28: Operation timed out after 10001 milliseconds with 0 bytes received for ' . $url );
				}
				if ( 'network' === $s['response'] ) {
					return new \WP_Error( 'http_request_failed', 'cURL error 7: Failed to connect to api.telegram.org port 443' );
				}
				if ( 'malformed' === $s['response'] ) {
					return array( 'headers' => array(), 'body' => '<html>oops</html>', 'response' => array( 'code' => 200, 'message' => 'OK' ), 'cookies' => array() );
				}
				return $this->json( $s['response'], $s['http'] );
			}
		}
		return $this->json( array( 'ok' => true, 'result' => $this->result( $method, $params ) ) );
	}

	/**
	 * @return mixed
	 */
	private function result( string $method, array $p ) {
		switch ( $method ) {
			case 'getMe':
				return array( 'id' => 123456789, 'is_bot' => true, 'first_name' => 'Support Bot', 'username' => 'tvx_test_bot', 'can_join_groups' => true, 'can_read_all_group_messages' => $this->read_all );
			case 'sendMessage':
			case 'sendPhoto':
			case 'sendDocument':
			case 'sendVoice':
				$chat                    = (string) $p['chat_id'];
				$this->next_id[ $chat ] = ( $this->next_id[ $chat ] ?? 1000 ) + 1;
				$r                       = array( 'message_id' => $this->next_id[ $chat ], 'chat' => array( 'id' => $chat ), 'date' => time() );
				if ( isset( $p['message_thread_id'] ) ) {
					$r['message_thread_id'] = (int) $p['message_thread_id'];
				}
				return $r;
			case 'createForumTopic':
				++$this->next_thread;
				return array( 'message_thread_id' => $this->next_thread, 'name' => $p['name'], 'icon_color' => 7322096 );
			case 'getChat':
				return $this->chats[ (string) $p['chat_id'] ] ?? array( 'id' => $p['chat_id'], 'type' => 'private', 'first_name' => 'Op' );
			case 'getChatMember':
				return array( 'status' => 'administrator', 'can_manage_topics' => true, 'user' => array( 'id' => $p['user_id'] ) );
			case 'getWebhookInfo':
				return array( 'url' => $this->webhook_url, 'pending_update_count' => 0 );
			case 'setWebhook':
				$this->webhook_url = (string) $p['url'];
				return true;
			case 'deleteWebhook':
				$this->webhook_url = '';
				return true;
			case 'getFile':
				return array( 'file_id' => $p['file_id'], 'file_path' => 'photos/file_1.png', 'file_size' => 68 );
			default:
				return true;
		}
	}

	/**
	 * @param array<string,mixed> $body
	 * @return array<string,mixed>
	 */
	private function json( array $body, int $code = 200 ): array {
		return array( 'headers' => array( 'content-type' => 'application/json' ), 'body' => wp_json_encode( $body ), 'response' => array( 'code' => $code, 'message' => '' ), 'cookies' => array() );
	}
}
