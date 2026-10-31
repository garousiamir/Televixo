<?php
/**
 * Durable delivery: retries, uncertainty, partial sends, leases, ordering.
 */

namespace Televixo\Tests;

use Televixo\Core\Clock;
use Televixo\Core\Settings;
use Televixo\Persistence\Db;
use Televixo\Queue\Outbox;

final class DeliveryTest extends TestCase {

	public function set_up(): void {
		parent::set_up();
		$this->configure_telegram( 'reply' );
	}

	private function job(): array {
		return Db::row( Db::prepare( 'SELECT * FROM {outbox} ORDER BY id DESC LIMIT 1' ) );
	}

	private function make_due(): void {
		Db::exec( Db::prepare( "UPDATE {outbox} SET available_at = %s WHERE status = 'pending'", gmdate( 'Y-m-d H:i:s', time() - 1 ) ) );
	}

	private function state( string $body ): string {
		return (string) Db::var( Db::prepare( 'SELECT delivery_state FROM {messages} WHERE body = %s', $body ) );
	}

	public function test_rate_limit_respects_retry_after(): void {
		$s = $this->new_visitor_session();
		$c = $this->start_conversation( $s );
		$this->tg->fail_next( 'sendMessage', array( 'ok' => false, 'error_code' => 429, 'description' => 'Too Many Requests: retry after 17', 'parameters' => array( 'retry_after' => 17 ) ), 429 );
		$this->visitor_sends( $s, $c['public_id'], 'x' );
		$this->run_worker();
		$job   = $this->job();
		$delay = strtotime( $job['available_at'] . ' UTC' ) - time();
		$this->assertSame( 'pending', $job['status'] );
		$this->assertSame( 'rate_limited', $job['last_error_code'] );
		$this->assertGreaterThanOrEqual( 16, $delay );
		$this->assertLessThanOrEqual( 20, $delay );
		$this->make_due();
		$this->run_worker();
		$this->assertSame( 'done', $this->job()['status'] );
		$this->assertSame( 'provider_accepted', $this->state( 'x' ) );
	}

	public function test_outage_retries_with_backoff_then_recovers(): void {
		$s = $this->new_visitor_session();
		$c = $this->start_conversation( $s );
		for ( $i = 0; $i < 3; $i++ ) {
			$this->tg->fail_next( 'sendMessage', 'network' );
		}
		$this->visitor_sends( $s, $c['public_id'], 'during outage' );
		$delays = array();
		for ( $i = 0; $i < 3; $i++ ) {
			$this->run_worker();
			$job      = $this->job();
			$delays[] = strtotime( $job['available_at'] . ' UTC' ) - time();
			$this->assertSame( 'network_error', $job['last_error_code'] );
			$this->make_due();
		}
		$this->assertLessThanOrEqual( 5, $delays[0] );
		$this->assertLessThanOrEqual( 20, $delays[2] );
		$this->run_worker();
		$this->assertSame( 'done', $this->job()['status'] );
		$this->assertSame( 4, $this->tg->count( 'sendMessage' ) );
	}

	public function test_timeout_is_held_as_uncertain_not_blindly_retried(): void {
		$s = $this->new_visitor_session();
		$c = $this->start_conversation( $s );
		$this->tg->fail_next( 'sendMessage', 'timeout' );
		$this->visitor_sends( $s, $c['public_id'], 'maybe sent' );
		$this->visitor_sends( $s, $c['public_id'], 'next one' );
		$this->run_worker();
		$this->assertSame( 'uncertain', $this->state( 'maybe sent' ) );
		$this->assertSame( 'provider_accepted', $this->state( 'next one' ), 'Uncertain jobs do not block later messages' );
		$this->assertSame( 2, $this->tg->count( 'sendMessage' ) );
		$this->run_worker();
		$this->assertSame( 2, $this->tg->count( 'sendMessage' ), 'No automatic resend of an uncertain message' );
		// Manual retry from the queue screen.
		$id = (int) Db::var( Db::prepare( "SELECT id FROM {outbox} WHERE status = 'uncertain'" ) );
		$this->assertTrue( Outbox::manual_retry( $id ) );
		$this->run_worker();
		$this->assertSame( 'provider_accepted', $this->state( 'maybe sent' ) );
	}

	public function test_uncertain_policy_retry(): void {
		Settings::update( array( 'telegram' => array( 'uncertain_policy' => 'retry' ) ) );
		$s = $this->new_visitor_session();
		$c = $this->start_conversation( $s );
		$this->tg->fail_next( 'sendMessage', 'malformed' );
		$this->visitor_sends( $s, $c['public_id'], 'x' );
		$this->run_worker();
		$this->assertSame( 'pending', $this->job()['status'] );
	}

	public function test_partial_multipart_send_resumes_at_next_part(): void {
		Settings::update( array( 'limits' => array( 'max_message_chars' => 20000 ) ) );
		$s = $this->new_visitor_session();
		$c = $this->start_conversation( $s );
		$this->visitor_sends( $s, $c['public_id'], str_repeat( 'word ', 1600 ) ); // 2–3 chunks
		// First part OK, second fails transiently.
		$this->tg->script[] = array( 'method' => 'sendMessage', 'response' => array( 'ok' => true, 'result' => array( 'message_id' => 7001 ) ), 'http' => 200 );
		$this->tg->fail_next( 'sendMessage', 'network' );
		$this->run_worker();
		$this->assertSame( 'partially_sent', (string) Db::var( Db::prepare( "SELECT delivery_state FROM {messages} WHERE author_type = 'visitor'" ) ) );
		$this->assertSame( array( 'text:0' ), Outbox::progress( $this->job() )['done'] );
		$this->make_due();
		$this->run_worker();
		$texts = array_column( $this->tg->sent(), 'text' );
		preg_match( '/\(1\/(\d)\)/', $texts[0], $m );
		$parts = (int) $m[1];
		$this->assertGreaterThanOrEqual( 2, $parts );
		$this->assertStringContainsString( "(2/$parts)", $texts[1], 'failed attempt' );
		$this->assertStringContainsString( "(2/$parts)", $texts[2], 'retry resumes at part 2' );
		$this->assertCount( $parts + 1, $texts, 'Part 1 is not re-sent after the partial failure' );
		$this->assertSame( $parts, (int) Db::var( Db::prepare( "SELECT COUNT(*) FROM {provider_messages} WHERE direction = 'out'" ) ) );
	}

	public function test_permanent_failure_goes_to_dead_letter_and_flags_health(): void {
		$s = $this->new_visitor_session();
		$c = $this->start_conversation( $s );
		$this->tg->fail_next( 'sendMessage', array( 'ok' => false, 'error_code' => 403, 'description' => 'Forbidden: bot was kicked from the supergroup chat' ), 403 );
		$this->visitor_sends( $s, $c['public_id'], 'x' );
		$this->run_worker();
		$this->assertSame( 'dead', $this->job()['status'] );
		$this->assertSame( 'bot_removed', $this->job()['last_error_code'] );
		$this->assertSame( 'failed', $this->state( 'x' ) );
		$this->assertSame( 'bot_removed', \Televixo\Telegram\Health::all()['destination']['code'] );
	}

	public function test_expired_credentials_retry_slowly(): void {
		$s = $this->new_visitor_session();
		$c = $this->start_conversation( $s );
		$this->tg->fail_next( 'sendMessage', array( 'ok' => false, 'error_code' => 401, 'description' => 'Unauthorized' ), 401 );
		$this->visitor_sends( $s, $c['public_id'], 'x' );
		$this->run_worker();
		$job = $this->job();
		$this->assertSame( 'pending', $job['status'] );
		$this->assertGreaterThan( 1700, strtotime( $job['available_at'] . ' UTC' ) - time() );
		$this->assertArrayHasKey( 'token', \Televixo\Telegram\Health::all() );
	}

	public function test_crashed_worker_lease_expires_and_job_is_recovered(): void {
		$s = $this->new_visitor_session();
		$c = $this->start_conversation( $s );
		$this->visitor_sends( $s, $c['public_id'], 'x' );
		$claimed = Outbox::claim( 1 ); // a worker claims, then "crashes"
		$this->assertCount( 1, $claimed );
		$this->assertSame( array(), Outbox::claim( 1 ), 'Leased job is not claimable while the lease is valid' );
		Clock::freeze( time() + Outbox::LEASE_SECONDS + 5 );
		$recovered = Outbox::claim( 1 );
		$this->assertCount( 1, $recovered );
		$this->assertFalse( Outbox::complete( $claimed[0] ), 'Stale lease holder cannot complete the job' );
		$this->assertTrue( Outbox::complete( $recovered[0] ) );
	}

	public function test_per_conversation_ordering_is_preserved_across_retries(): void {
		$s = $this->new_visitor_session();
		$c = $this->start_conversation( $s );
		$this->tg->fail_next( 'sendMessage', 'network' );
		foreach ( array( 'one', 'two', 'three' ) as $t ) {
			$this->visitor_sends( $s, $c['public_id'], $t );
		}
		$this->run_worker();
		$this->assertSame( 1, $this->tg->count( 'sendMessage' ), 'Later messages wait for the head of the conversation queue' );
		$this->make_due();
		$this->run_worker();
		$texts = array_map( static fn( $t ) => substr( $t, strrpos( $t, "\n" ) + 1 ), array_column( $this->tg->sent(), 'text' ) );
		$this->assertSame( array( 'one', 'one', 'two', 'three' ), $texts );
	}

	public function test_idempotent_visitor_message(): void {
		$s = $this->new_visitor_session();
		$c = $this->start_conversation( $s );
		$r1 = $this->visitor_sends( $s, $c['public_id'], 'same', 'client-key-123456' );
		$r2 = $this->visitor_sends( $s, $c['public_id'], 'same', 'client-key-123456' );
		$this->assertSame( 201, $r1->get_status() );
		$this->assertSame( 200, $r2->get_status() );
		$this->assertTrue( $r2->get_data()['duplicate'] );
		$this->assertSame( $r1->get_data()['message']['id'], $r2->get_data()['message']['id'] );
		$this->assertSame( 1, (int) Db::var( Db::prepare( 'SELECT COUNT(*) FROM {outbox}' ) ) );
	}

	public function test_backoff_is_bounded_with_jitter(): void {
		for ( $a = 1; $a <= 20; $a++ ) {
			$d = Outbox::backoff( $a );
			$this->assertLessThanOrEqual( Outbox::MAX_DELAY, $d );
			$this->assertGreaterThanOrEqual( 1, $d );
		}
	}

	public function test_classification(): void {
		$c = \Televixo\Telegram\BotApi::classify( new \WP_Error( 'x', 'cURL error 28: timed out' ) );
		$this->assertSame( 'uncertain', $c->outcome );
		$c = \Televixo\Telegram\BotApi::classify( new \WP_Error( 'x', 'cURL error 6: Could not resolve host' ) );
		$this->assertSame( 'retryable', $c->outcome );
		$c = \Televixo\Telegram\BotApi::classify( array( 'response' => array( 'code' => 504 ), 'body' => 'Gateway Timeout' ) );
		$this->assertSame( 'uncertain', $c->outcome );
		$c = \Televixo\Telegram\BotApi::classify( array( 'response' => array( 'code' => 502 ), 'body' => 'Bad gateway' ) );
		$this->assertSame( 'retryable', $c->outcome );
		$c = \Televixo\Telegram\BotApi::classify( array( 'response' => array( 'code' => 400 ), 'body' => '{"ok":false,"error_code":400,"description":"Bad Request: message is too long"}' ) );
		$this->assertSame( 'permanent', $c->outcome );
		$this->assertSame( 'message_too_long', $c->error_code_slug() );
		$c = \Televixo\Telegram\BotApi::classify( array( 'response' => array( 'code' => 200 ), 'body' => '{"ok":true,"result":{"message_id":1,"chat":{"id":-1001234567890123}}}' ) );
		$this->assertSame( '-1001234567890123', (string) $c->result['chat']['id'], 'Large IDs keep precision' );
	}
}
