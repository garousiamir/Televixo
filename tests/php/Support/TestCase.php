<?php
/**
 * Base test case with helpers for visitors, operators and Telegram updates.
 */

namespace Televixo\Tests;

use Televixo\Core\Clock;
use Televixo\Core\Settings;
use Televixo\Domain\Conversations;
use Televixo\Domain\Operators;
use Televixo\Persistence\Db;
use Televixo\Persistence\Migrator;
use Televixo\Persistence\Schema;
use Televixo\Provider\Registry;
use Televixo\Queue\Worker;
use Televixo\Security\Secrets;
use Televixo\Security\SessionManager;

abstract class TestCase extends \WP_UnitTestCase {

	protected FakeTelegram $tg;
	protected static int $update_id = 9000;

	public static function set_up_before_class(): void {
		parent::set_up_before_class();
		// dbDelta CREATE TABLE causes implicit commits, so tables are created
		// once and truncated per test instead of relying on rollback.
		Migrator::apply_schema();
		update_option( Migrator::OPTION, Migrator::CURRENT );
	}

	public function set_up(): void {
		parent::set_up();
		foreach ( Schema::TABLES as $t ) {
			Db::wpdb()->query( 'DELETE FROM ' . Schema::table( $t ) ); // phpcs:ignore
		}
		\Televixo\Security\Capabilities::install();
		delete_option( Settings::OPTION );
		delete_option( Secrets::OPTION );
		delete_option( 'televixo_health' );
		delete_option( 'televixo_blocked_networks' );
		Settings::flush();
		Registry::reset();
		Clock::freeze( null );
		$this->tg = new FakeTelegram();
		$_SERVER['REMOTE_ADDR'] = '203.0.113.' . wp_rand( 1, 250 );
		$_COOKIE                = array();
		SessionManager::reset_request_cache();
	}

	public function tear_down(): void {
		$this->tg->remove();
		Clock::freeze( null );
		parent::tear_down();
	}

	protected function configure_telegram( string $mode = 'reply', string $chat = '-1001000000001' ): void {
		Secrets::set( 'bot_token', FakeTelegram::TOKEN );
		Secrets::set( 'webhook_secret', 'test-secret-abc' );
		Settings::set_internal( 'telegram.bot_id', '123456789' );
		Settings::set_internal( 'telegram.bot_username', 'tvx_test_bot' );
		Settings::set_internal( 'telegram.destination_chat_id', $chat );
		Settings::set_internal( 'telegram.routing_mode', $mode );
	}

	/**
	 * @return array<string,mixed> Session row.
	 */
	protected function new_visitor_session( string $name = '' ): array {
		$_COOKIE = array();
		SessionManager::reset_request_cache();
		$_SERVER['REMOTE_ADDR'] = '198.51.100.' . wp_rand( 1, 250 );
		$s = SessionManager::create();
		if ( '' !== $name ) {
			Db::update( 'visitors', array( 'name' => $name ), array( 'id' => (int) $s['visitor_id'] ) );
		}
		return $s;
	}

	protected function use_session( array $session ): void {
		$_COOKIE[ SessionManager::COOKIE ] = $session['token'];
		SessionManager::reset_request_cache();
	}

	/**
	 * @return array<string,mixed> Operator row linked to a Telegram user.
	 */
	protected function operator( string $telegram_id = '', string $role = 'administrator', string $name = 'Olivia Operator' ): array {
		$uid = self::factory()->user->create( array( 'role' => $role, 'display_name' => $name ) );
		$op  = Operators::for_user( $uid );
		if ( '' !== $telegram_id ) {
			Db::update( 'operators', array( 'telegram_user_id' => $telegram_id ), array( 'id' => (int) $op['id'] ) );
		}
		return Operators::get( (int) $op['id'] );
	}

	protected function run_worker(): array {
		return Worker::run( 5.0 );
	}

	/**
	 * Telegram reply update from an operator.
	 *
	 * @param array<string,mixed> $extra
	 * @return array<string,mixed>
	 */
	protected function tg_message( string $chat, string $from, string $text, ?int $reply_to = null, array $extra = array() ): array {
		$msg = array_merge(
			array(
				'message_id' => wp_rand( 5000, 900000 ),
				'from'       => array( 'id' => (int) $from, 'is_bot' => false, 'first_name' => 'Op' ),
				'chat'       => array( 'id' => (int) $chat, 'type' => 'supergroup', 'title' => 'Support' ),
				'date'       => time(),
				'text'       => $text,
			),
			$extra
		);
		if ( null !== $reply_to ) {
			$msg['reply_to_message'] = array( 'message_id' => $reply_to, 'chat' => array( 'id' => (int) $chat ) );
		}
		return array( 'update_id' => ++self::$update_id, 'message' => $msg );
	}

	protected function deliver_update( array $update ): void {
		\Televixo\Telegram\Inbound::store( '123456789', $update );
		$this->run_worker();
	}

	protected function rest( string $method, string $route, array $body = array(), array $headers = array() ): \WP_REST_Response {
		$req = new \WP_REST_Request( $method, '/televixo/v1' . $route );
		if ( 'GET' === $method ) {
			foreach ( $body as $k => $v ) {
				$req->set_param( $k, $v );
			}
		} elseif ( $body ) {
			$req->set_header( 'Content-Type', 'application/json' );
			$req->set_body( wp_json_encode( $body ) );
		} else {
			$req->set_header( 'Content-Type', 'application/json' );
		}
		foreach ( $headers as $k => $v ) {
			$req->set_header( $k, $v );
		}
		return rest_get_server()->dispatch( $req );
	}

	protected function csrf( array $session ): array {
		return array( 'X-Televixo-CSRF' => SessionManager::csrf_for( (string) $session['token'] ) );
	}

	protected function visitor_sends( array $session, string $conv_public_id, string $text, string $client_id = '' ): \WP_REST_Response {
		$this->use_session( $session );
		return $this->rest( 'POST', "/conversations/$conv_public_id/messages", array( 'body' => $text, 'client_id' => $client_id ?: wp_generate_password( 16, false ) ), $this->csrf( $session ) );
	}

	protected function start_conversation( array $session ): array {
		$this->use_session( $session );
		$res = $this->rest( 'POST', '/conversations', array( 'context' => array( 'page_path' => '/pricing?secret=1' ) ), $this->csrf( $session ) );
		$this->assertSame( 200, $res->get_status(), wp_json_encode( $res->get_data() ) );
		return Conversations::by_public_id( $res->get_data()['conversation']['id'] );
	}
}
