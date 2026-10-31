<?php
/**
 * End-to-end Reply Mode through the REST API, outbox worker and webhook
 * processor, using the fake Bot API.
 */

namespace Televixo\Tests;

use Televixo\Domain\Conversations;
use Televixo\Domain\Messages;
use Televixo\Persistence\Db;
use Televixo\Telegram\Mappings;

final class ReplyModeTest extends TestCase {

	public function set_up(): void {
		parent::set_up();
		$this->configure_telegram( 'reply' );
	}

	public function test_visitor_message_is_stored_relayed_and_mapped(): void {
		$s    = $this->new_visitor_session( 'Anna' );
		$conv = $this->start_conversation( $s );
		$res  = $this->visitor_sends( $s, $conv['public_id'], 'Hello <b>there</b>' );
		$this->assertSame( 201, $res->get_status() );
		$this->assertSame( 'sent', $res->get_data()['message']['state'] );
		$this->assertSame( 0, $this->tg->count( 'sendMessage' ), 'Telegram must not be contacted inside the request' );

		$this->run_worker();
		$sent = $this->tg->sent();
		$this->assertCount( 1, $sent );
		$this->assertSame( '-1001000000001', (string) $sent[0]['chat_id'] );
		$this->assertStringContainsString( $conv['reference'], $sent[0]['text'] );
		$this->assertStringContainsString( 'Anna', $sent[0]['text'] );
		$this->assertStringContainsString( 'Hello <b>there</b>', $sent[0]['text'] );
		$this->assertStringContainsString( '/pricing', $sent[0]['text'] );
		$this->assertStringNotContainsString( 'secret=1', $sent[0]['text'], 'Query strings must not be relayed' );
		$this->assertArrayNotHasKey( 'parse_mode', $sent[0], 'Plain text only: visitor text cannot inject markup' );

		$msg = Messages::get( (int) Db::var( Db::prepare( 'SELECT id FROM {messages} WHERE conversation_id = %d', (int) $conv['id'] ) ) );
		$this->assertSame( 'provider_accepted', $msg['delivery_state'] );
		$this->assertNotNull( Mappings::find_message( '123456789', '-1001000000001', '1001' ) );
	}

	public function test_operator_reply_reaches_only_the_right_visitor(): void {
		$op = $this->operator( '777' );
		$a  = $this->new_visitor_session( 'A' );
		$b  = $this->new_visitor_session( 'B' );
		$ca = $this->start_conversation( $a );
		$this->visitor_sends( $a, $ca['public_id'], 'from A' );
		$cb = $this->start_conversation( $b );
		$this->visitor_sends( $b, $cb['public_id'], 'from B' );
		$this->run_worker();
		// 1001 = A's message, 1002 = B's message. Reply to A's (older) message.
		$this->deliver_update( $this->tg_message( '-1001000000001', '777', 'Answer for A', 1001 ) );

		$this->use_session( $a );
		$items = $this->rest( 'GET', "/conversations/{$ca['public_id']}/messages" )->get_data()['items'];
		$this->assertSame( 'Answer for A', end( $items )['body'] );
		$this->assertSame( 'operator', end( $items )['author'] );

		$this->use_session( $b );
		$items = $this->rest( 'GET', "/conversations/{$cb['public_id']}/messages" )->get_data()['items'];
		$this->assertCount( 1, $items, 'B must not see the reply meant for A' );

		$fresh = Conversations::get( (int) $ca['id'] );
		$this->assertSame( (int) $op['id'], (int) $fresh['assigned_operator_id'], 'Replying auto-claims' );
		$this->assertSame( 'waiting', $fresh['status'] );
		$this->assertNotNull( $fresh['first_human_response_at'] );
	}

	public function test_reply_to_any_chunk_of_a_long_message_routes_correctly(): void {
		$this->operator( '777' );
		\Televixo\Core\Settings::update( array( 'limits' => array( 'max_message_chars' => 20000 ) ) );
		$s    = $this->new_visitor_session();
		$conv = $this->start_conversation( $s );
		$long = str_repeat( 'Lorem ipsum dolor sit amet 😀 ', 300 ); // ~9000 chars incl. surrogate pairs
		$this->assertSame( 201, $this->visitor_sends( $s, $conv['public_id'], $long )->get_status() );
		$this->run_worker();
		$sent = $this->tg->sent();
		$this->assertGreaterThanOrEqual( 3, count( $sent ) );
		foreach ( $sent as $part ) {
			$this->assertLessThanOrEqual( 4096, \Televixo\Telegram\Formatter::utf16_length( $part['text'] ) );
			$this->assertStringContainsString( $conv['reference'], $part['text'] );
		}
		$last_part_id = 1000 + count( $sent );
		$this->deliver_update( $this->tg_message( '-1001000000001', '777', 'Reply to the last chunk', $last_part_id ) );
		$this->use_session( $s );
		$items = $this->rest( 'GET', "/conversations/{$conv['public_id']}/messages" )->get_data()['items'];
		$this->assertSame( 'Reply to the last chunk', end( $items )['body'] );
	}

	public function test_reply_to_operator_message_continues_the_chain(): void {
		$this->operator( '777' );
		$this->operator( '888', 'administrator', 'Second Op' );
		$s    = $this->new_visitor_session();
		$conv = $this->start_conversation( $s );
		$this->visitor_sends( $s, $conv['public_id'], 'hi' );
		$this->run_worker();
		$first = $this->tg_message( '-1001000000001', '777', 'first answer', 1001 );
		$this->deliver_update( $first );
		// Second operator (view-all) replies to the first operator's Telegram message.
		$this->deliver_update( $this->tg_message( '-1001000000001', '888', 'follow up', (int) $first['message']['message_id'] ) );
		$this->use_session( $s );
		$bodies = array_column( $this->rest( 'GET', "/conversations/{$conv['public_id']}/messages" )->get_data()['items'], 'body' );
		$this->assertSame( array( 'hi', 'first answer', 'follow up' ), $bodies );
	}

	public function test_unmapped_unauthorized_and_foreign_chat_replies_are_rejected(): void {
		$this->operator( '777' );
		$s    = $this->new_visitor_session();
		$conv = $this->start_conversation( $s );
		$this->visitor_sends( $s, $conv['public_id'], 'hi' );
		$this->run_worker();
		$before = (int) Db::var( Db::prepare( "SELECT COUNT(*) FROM {messages} WHERE author_type = 'operator'" ) );

		// Unmapped reply (old update so it is not deferred).
		$u = $this->tg_message( '-1001000000001', '777', 'to nowhere', 4242 );
		$u['message']['date'] = time() - 600;
		$this->deliver_update( $u );
		// Not enrolled sender replying to a mapped message.
		$this->deliver_update( $this->tg_message( '-1001000000001', '999', 'intruder', 1001 ) );
		// Same message ID in a chat that is not allowlisted.
		$this->deliver_update( $this->tg_message( '-1009999999999', '777', 'wrong chat', 1001 ) );
		// Bot echo.
		$echo = $this->tg_message( '-1001000000001', '777', 'echo', 1001 );
		$echo['message']['from']['is_bot'] = true;
		$this->deliver_update( $echo );
		// Anonymous group admin.
		$anon = $this->tg_message( '-1001000000001', '1087968824', 'anon', 1001, array( 'sender_chat' => array( 'id' => -1001000000001, 'type' => 'supergroup' ) ) );
		$anon['message']['from']['username'] = 'GroupAnonymousBot';
		$anon['message']['from']['is_bot']   = true;
		$this->deliver_update( $anon );

		$after = (int) Db::var( Db::prepare( "SELECT COUNT(*) FROM {messages} WHERE author_type = 'operator'" ) );
		$this->assertSame( $before, $after, 'None of the rejected messages may reach a visitor' );
		$results = Db::wpdb()->get_col( Db::prepare( 'SELECT result_code FROM {inbound_updates} ORDER BY id ASC' ) );
		$this->assertSame( array( 'ignored:unmapped_reply', 'ignored:unauthorized_sender', 'ignored:chat_not_allowed', 'ignored:bot_sender', 'ignored:anonymous_sender' ), $results );
		$this->run_worker();
		$notices = array_column( array_slice( $this->tg->sent(), 1 ), 'text' );
		$this->assertCount( 3, $notices, 'Operators get safe feedback for unmapped, unauthorized and anonymous replies' );
	}

	public function test_duplicate_and_out_of_order_updates(): void {
		$this->operator( '777' );
		$s    = $this->new_visitor_session();
		$conv = $this->start_conversation( $s );
		$this->visitor_sends( $s, $conv['public_id'], 'hi' );
		$u = $this->tg_message( '-1001000000001', '777', 'early reply', 1001 );
		// The reply arrives before the outbound mapping exists: deferred, not dropped.
		$this->assertTrue( \Televixo\Telegram\Inbound::store( '123456789', $u ) );
		$this->assertFalse( \Televixo\Telegram\Inbound::store( '123456789', $u ), 'Duplicate update_id is ignored' );
		\Televixo\Telegram\Inbound::process_batch( 10, microtime( true ) + 5 );
		$this->assertSame( 'deferred', Db::var( Db::prepare( 'SELECT result_code FROM {inbound_updates}' ) ) );
		$this->run_worker(); // delivers visitor message → mapping 1001
		Db::exec( Db::prepare( 'UPDATE {inbound_updates} SET lease_expires_at = %s', gmdate( 'Y-m-d H:i:s', time() - 1 ) ) );
		$this->run_worker();
		$this->assertSame( 'processed:reply', Db::var( Db::prepare( 'SELECT result_code FROM {inbound_updates}' ) ) );
		$this->assertSame( 1, (int) Db::var( Db::prepare( "SELECT COUNT(*) FROM {messages} WHERE author_type = 'operator'" ) ) );
	}

	public function test_inbox_reply_is_mirrored_and_mapped(): void {
		$op = $this->operator( '777' );
		wp_set_current_user( (int) $op['wp_user_id'] );
		$s    = $this->new_visitor_session();
		$conv = $this->start_conversation( $s );
		$this->visitor_sends( $s, $conv['public_id'], 'hi' );
		$this->run_worker();
		$res = $this->rest( 'POST', "/admin/conversations/{$conv['public_id']}/messages", array( 'body' => 'From the inbox' ) );
		$this->assertSame( 201, $res->get_status(), wp_json_encode( $res->get_data() ) );
		$this->run_worker();
		$all    = $this->tg->sent();
		$mirror = end( $all );
		$this->assertStringContainsString( 'From the inbox', $mirror['text'] );
		$this->assertSame( 1001, $mirror['reply_parameters']['message_id'] );
		// A Telegram reply to the mirrored message routes back to the same visitor.
		$this->deliver_update( $this->tg_message( '-1001000000001', '777', 'and from telegram', 1002 ) );
		$this->use_session( $s );
		$bodies = array_column( $this->rest( 'GET', "/conversations/{$conv['public_id']}/messages" )->get_data()['items'], 'body' );
		$this->assertSame( array( 'hi', 'From the inbox', 'and from telegram' ), $bodies );
	}

	public function test_callback_buttons_are_authorized_independently(): void {
		$op   = $this->operator( '777' );
		$s    = $this->new_visitor_session();
		$conv = $this->start_conversation( $s );
		$this->visitor_sends( $s, $conv['public_id'], 'hi' );
		$this->run_worker();
		$cb = static fn( $from, $data ) => array(
			'update_id'      => ++self::$update_id,
			'callback_query' => array( 'id' => 'q' . self::$update_id, 'from' => array( 'id' => $from ), 'data' => $data, 'message' => array( 'message_id' => 1001, 'chat' => array( 'id' => -1001000000001 ) ) ),
		);
		$this->deliver_update( $cb( 999, 'tvx:claim:' . $conv['public_id'] ) );
		$this->assertNull( Conversations::get( (int) $conv['id'] )['assigned_operator_id'], 'Unknown sender cannot claim via a button' );
		$this->deliver_update( $cb( 777, 'tvx:claim:' . $conv['public_id'] ) );
		$this->assertSame( (int) $op['id'], (int) Conversations::get( (int) $conv['id'] )['assigned_operator_id'] );
		$this->deliver_update( $cb( 777, 'tvx:close:' . $conv['public_id'] ) );
		$this->assertSame( 'closed', Conversations::get( (int) $conv['id'] )['status'] );
		$this->assertSame( 3, $this->tg->count( 'answerCallbackQuery' ) );
	}

	public function test_enrollment_challenge_is_one_time_and_expires(): void {
		$op        = $this->operator();
		$challenge = \Televixo\Domain\Operators::create_challenge( (int) $op['id'] );
		$priv      = static fn( $text, $from ) => array(
			'update_id' => ++self::$update_id,
			'message'   => array( 'message_id' => 1, 'from' => array( 'id' => $from, 'is_bot' => false, 'first_name' => 'X', 'username' => 'xop' ), 'chat' => array( 'id' => $from, 'type' => 'private' ), 'date' => time(), 'text' => $text ),
		);
		$this->deliver_update( $priv( '/link ' . $challenge['code'], 4242 ) );
		$this->assertSame( '4242', \Televixo\Domain\Operators::get( (int) $op['id'] )['telegram_user_id'] );
		$this->deliver_update( $priv( '/link ' . $challenge['code'], 5353 ) );
		$this->assertSame( '4242', \Televixo\Domain\Operators::get( (int) $op['id'] )['telegram_user_id'], 'Code cannot be reused' );

		$c2 = \Televixo\Domain\Operators::create_challenge( (int) $op['id'] );
		\Televixo\Core\Clock::freeze( time() + 11 * MINUTE_IN_SECONDS );
		$this->assertNull( \Televixo\Domain\Operators::consume_challenge( $c2['code'], '6464', '' ) );
	}

	public function test_twenty_concurrent_visitors_no_leakage(): void {
		$this->operator( '777' );
		$visitors = array();
		for ( $i = 0; $i < 20; $i++ ) {
			$s            = $this->new_visitor_session( "V$i" );
			$c            = $this->start_conversation( $s );
			$visitors[ $i ] = array( 's' => $s, 'c' => $c );
		}
		// Interleave messages from all visitors.
		for ( $round = 0; $round < 2; $round++ ) {
			foreach ( $visitors as $i => $v ) {
				$this->visitor_sends( $v['s'], $v['c']['public_id'], "V$i round $round" );
			}
		}
		$this->run_worker();
		// Operators reply to each visitor's first message in reverse order.
		foreach ( array_reverse( $visitors, true ) as $i => $v ) {
			$map = Db::row( Db::prepare( "SELECT provider_message_id FROM {provider_messages} WHERE conversation_id = %d AND direction = 'out' ORDER BY id ASC LIMIT 1", (int) $v['c']['id'] ) );
			$this->deliver_update( $this->tg_message( '-1001000000001', '777', "answer for V$i", (int) $map['provider_message_id'] ) );
		}
		foreach ( $visitors as $i => $v ) {
			$this->use_session( $v['s'] );
			$bodies = array_column( $this->rest( 'GET', "/conversations/{$v['c']['public_id']}/messages" )->get_data()['items'], 'body' );
			$this->assertSame( array( "V$i round 0", "V$i round 1", "answer for V$i" ), $bodies );
			// Cross-session access to another visitor's conversation is a 404.
			$other = $visitors[ ( $i + 1 ) % 20 ]['c']['public_id'];
			$this->assertSame( 404, $this->rest( 'GET', "/conversations/$other/messages" )->get_status() );
		}
	}
}
