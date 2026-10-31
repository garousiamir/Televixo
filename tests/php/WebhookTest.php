<?php
/**
 * Webhook authentication and durable acknowledgement.
 */

namespace Televixo\Tests;

use Televixo\Persistence\Db;

final class WebhookTest extends TestCase {

	public function set_up(): void {
		parent::set_up();
		$this->configure_telegram();
	}

	private function post( string $body, array $headers ): \WP_REST_Response {
		$req = new \WP_REST_Request( 'POST', '/televixo/v1/telegram/webhook' );
		$req->set_header( 'Content-Type', 'application/json' );
		foreach ( $headers as $k => $v ) {
			$req->set_header( $k, $v );
		}
		$req->set_body( $body );
		return rest_get_server()->dispatch( $req );
	}

	public function test_forged_or_missing_secret_is_rejected(): void {
		$body = wp_json_encode( array( 'update_id' => 1, 'message' => array() ) );
		$this->assertSame( 403, $this->post( $body, array() )->get_status() );
		$this->assertSame( 403, $this->post( $body, array( 'X-Telegram-Bot-Api-Secret-Token' => 'wrong' ) )->get_status() );
		$this->assertSame( 403, $this->post( $body, array( 'X-Telegram-Bot-Api-Secret-Token' => 'test-secret-ab' ) )->get_status() );
		$this->assertSame( 0, (int) Db::var( Db::prepare( 'SELECT COUNT(*) FROM {inbound_updates}' ) ) );
	}

	public function test_valid_update_is_stored_before_ack_and_deduplicated(): void {
		$h    = array( 'X-Telegram-Bot-Api-Secret-Token' => 'test-secret-abc' );
		$body = wp_json_encode( array( 'update_id' => 123456789012, 'message' => array( 'message_id' => 1, 'chat' => array( 'id' => 1, 'type' => 'private' ), 'text' => 'x' ) ) );
		$this->assertSame( 200, $this->post( $body, $h )->get_status() );
		$this->assertSame( 200, $this->post( $body, $h )->get_status() );
		$this->assertSame( 1, (int) Db::var( Db::prepare( 'SELECT COUNT(*) FROM {inbound_updates}' ) ) );
		$this->assertSame( '123456789012', Db::var( Db::prepare( 'SELECT update_id FROM {inbound_updates}' ) ) );
	}

	public function test_oversize_and_malformed(): void {
		$h = array( 'X-Telegram-Bot-Api-Secret-Token' => 'test-secret-abc' );
		$this->assertSame( 413, $this->post( '{"update_id":1,"x":"' . str_repeat( 'a', 1100000 ) . '"}', $h )->get_status() );
		// Invalid JSON is rejected by the REST server itself; nothing is stored.
		$this->assertSame( 400, $this->post( 'not json', $h )->get_status() );
		// Valid JSON without an update_id is acknowledged and ignored.
		$res = $this->post( '{"foo":1}', $h );
		$this->assertSame( 200, $res->get_status() );
		$this->assertSame( 'malformed', $res->get_data()['ignored'] );
		$this->assertSame( 0, (int) Db::var( Db::prepare( 'SELECT COUNT(*) FROM {inbound_updates}' ) ) );
	}
}
