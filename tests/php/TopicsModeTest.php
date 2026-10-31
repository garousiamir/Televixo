<?php
/**
 * Topics Mode routing, forwarding policy, topic lifecycle and independence
 * from Reply Mode conversations.
 */

namespace Televixo\Tests;

use Televixo\Core\Settings;
use Televixo\Domain\Conversations;
use Televixo\Persistence\Db;
use Televixo\Telegram\Mappings;

final class TopicsModeTest extends TestCase {

	private const FORUM = '-1001000000002';

	public function set_up(): void {
		parent::set_up();
		$this->configure_telegram( 'topics', self::FORUM );
	}

	private function topic_msg( string $from, string $text, int $thread, array $extra = array() ): array {
		$reply_to = isset( $extra['reply_to_message'] ) ? null : $thread;
		return $this->tg_message( self::FORUM, $from, $text, $reply_to, array_merge( array( 'message_thread_id' => $thread, 'is_topic_message' => true ), $extra ) );
	}

	public function test_topic_is_created_once_and_messages_route_by_thread(): void {
		$this->operator( '777' );
		$s    = $this->new_visitor_session( 'Tina' );
		$conv = $this->start_conversation( $s );
		$this->visitor_sends( $s, $conv['public_id'], 'one' );
		$this->visitor_sends( $s, $conv['public_id'], 'two' );
		$this->run_worker();
		$this->assertSame( 1, $this->tg->count( 'createForumTopic' ) );
		$fresh = Conversations::get( (int) $conv['id'] );
		$this->assertSame( '501', $fresh['provider_thread_id'] );
		foreach ( $this->tg->sent() as $m ) {
			$this->assertSame( 501, $m['message_thread_id'] );
		}
		// Plain message in the topic (implicit reply to the topic root) is routed.
		$this->deliver_update( $this->topic_msg( '777', 'hello from topic', 501 ) );
		$this->use_session( $s );
		$bodies = array_column( $this->rest( 'GET', "/conversations/{$conv['public_id']}/messages" )->get_data()['items'], 'body' );
		$this->assertSame( array( 'one', 'two', 'hello from topic' ), $bodies );
	}

	public function test_notes_commands_and_non_operator_chatter_stay_internal(): void {
		$this->operator( '777' );
		$s    = $this->new_visitor_session();
		$conv = $this->start_conversation( $s );
		$this->visitor_sends( $s, $conv['public_id'], 'hi' );
		$this->run_worker();
		$this->deliver_update( $this->topic_msg( '777', '#note check order 123', 501 ) );
		$this->deliver_update( $this->topic_msg( '777', '/help', 501 ) );
		$this->deliver_update( $this->topic_msg( '31337', 'random group member chatter', 501 ) );
		$this->assertSame( 0, (int) Db::var( Db::prepare( "SELECT COUNT(*) FROM {messages} WHERE author_type = 'operator'" ) ) );
		$this->assertSame( 'check order 123', Db::var( Db::prepare( 'SELECT body FROM {notes} WHERE conversation_id = %d', (int) $conv['id'] ) ) );
		// Notes are never visible through visitor routes.
		$this->use_session( $s );
		$json = wp_json_encode( $this->rest( 'GET', "/conversations/{$conv['public_id']}/messages" )->get_data() );
		$this->assertStringNotContainsString( 'order 123', $json );
	}

	public function test_replies_only_policy(): void {
		Settings::update( array( 'telegram' => array( 'topic_forwarding' => 'replies_only' ) ) );
		$this->operator( '777' );
		$s    = $this->new_visitor_session();
		$conv = $this->start_conversation( $s );
		$this->visitor_sends( $s, $conv['public_id'], 'hi' );
		$this->run_worker();
		$this->deliver_update( $this->topic_msg( '777', 'internal discussion', 501 ) );
		$this->deliver_update( $this->topic_msg( '777', 'explicit reply', 501, array( 'reply_to_message' => array( 'message_id' => 1001 ) ) ) );
		$bodies = Db::wpdb()->get_col( Db::prepare( "SELECT body FROM {messages} WHERE author_type = 'operator'" ) );
		$this->assertSame( array( 'explicit reply' ), $bodies, wp_json_encode( Db::rows( Db::prepare( 'SELECT result_code, payload FROM {inbound_updates}' ) ) ) );
	}

	public function test_closed_topic_is_reopened_and_deleted_topic_recreated(): void {
		$s    = $this->new_visitor_session();
		$conv = $this->start_conversation( $s );
		$this->visitor_sends( $s, $conv['public_id'], 'first' );
		$this->run_worker();
		// Someone closes the topic in Telegram.
		$this->deliver_update( $this->topic_msg( '777', '', 501, array( 'forum_topic_closed' => new \stdClass(), 'text' => null ) ) );
		$this->assertSame( 'closed', Mappings::find_thread( '123456789', self::FORUM, '501' )['state'] );
		$this->visitor_sends( $s, $conv['public_id'], 'second' );
		$this->run_worker();
		$this->assertSame( 1, $this->tg->count( 'reopenForumTopic' ) );

		// Topic deleted: Telegram reports thread not found; a new topic is created.
		$this->tg->fail_next( 'sendMessage', array( 'ok' => false, 'error_code' => 400, 'description' => 'Bad Request: message thread not found' ) );
		$this->visitor_sends( $s, $conv['public_id'], 'third' );
		$this->run_worker();
		Db::exec( Db::prepare( "UPDATE {outbox} SET available_at = %s WHERE status = 'pending'", gmdate( 'Y-m-d H:i:s', time() - 5 ) ) );
		$this->run_worker();
		$this->assertSame( 2, $this->tg->count( 'createForumTopic' ) );
		$this->assertSame( '502', Conversations::get( (int) $conv['id'] )['provider_thread_id'] );
		$this->assertSame( 'deleted', Mappings::find_thread( '123456789', self::FORUM, '501' )['state'] );
		$this->assertSame( 'provider_accepted', Db::var( Db::prepare( "SELECT delivery_state FROM {messages} WHERE body = 'third'" ) ) );
	}

	public function test_closing_conversation_closes_topic(): void {
		$op   = $this->operator( '777' );
		$s    = $this->new_visitor_session();
		$conv = $this->start_conversation( $s );
		$this->visitor_sends( $s, $conv['public_id'], 'hi' );
		$this->run_worker();
		$this->deliver_update( $this->topic_msg( '777', '/close', 501 ) );
		$this->run_worker();
		$this->assertSame( 'closed', Conversations::get( (int) $conv['id'] )['status'] );
		$this->assertSame( 1, $this->tg->count( 'closeForumTopic' ) );
	}

	public function test_changing_default_mode_keeps_existing_snapshots(): void {
		$this->operator( '777' );
		$s1 = $this->new_visitor_session();
		$c1 = $this->start_conversation( $s1 ); // topics
		$this->visitor_sends( $s1, $c1['public_id'], 'topic convo' );
		$this->run_worker();

		$this->configure_telegram( 'reply', '-1001000000001' );
		$s2 = $this->new_visitor_session();
		$c2 = $this->start_conversation( $s2 ); // reply
		$this->visitor_sends( $s2, $c2['public_id'], 'reply convo' );
		// The old topics conversation still delivers to its forum topic.
		$this->visitor_sends( $s1, $c1['public_id'], 'topic convo 2' );
		$this->run_worker();

		$this->assertSame( 'topics', Conversations::get( (int) $c1['id'] )['routing_mode'] );
		$this->assertSame( 'reply', Conversations::get( (int) $c2['id'] )['routing_mode'] );
		$by_chat = array();
		foreach ( $this->tg->sent() as $m ) {
			$by_chat[ (string) $m['chat_id'] ][] = $m;
		}
		$this->assertCount( 2, $by_chat[ self::FORUM ] );
		$this->assertCount( 1, $by_chat['-1001000000001'] );
		$this->assertArrayNotHasKey( 'message_thread_id', $by_chat['-1001000000001'][0] );

		// Both routes still accept operator replies independently.
		$this->deliver_update( $this->topic_msg( '777', 'answer topic', 501 ) );
		$this->deliver_update( $this->tg_message( '-1001000000001', '777', 'answer reply', 1001 ) );
		$this->assertSame( 'answer topic', Db::var( Db::prepare( "SELECT body FROM {messages} WHERE conversation_id = %d AND author_type = 'operator'", (int) $c1['id'] ) ) );
		$this->assertSame( 'answer reply', Db::var( Db::prepare( "SELECT body FROM {messages} WHERE conversation_id = %d AND author_type = 'operator'", (int) $c2['id'] ) ) );
	}

	public function test_reply_inside_other_topic_is_ambiguous(): void {
		$this->operator( '777' );
		$a  = $this->new_visitor_session();
		$ca = $this->start_conversation( $a );
		$this->visitor_sends( $a, $ca['public_id'], 'A' );
		$b  = $this->new_visitor_session();
		$cb = $this->start_conversation( $b );
		$this->visitor_sends( $b, $cb['public_id'], 'B' );
		$this->run_worker(); // A -> topic 501 msg 1002 (1001 is... ) B -> topic 502
		$a_msg = (int) Db::var( Db::prepare( "SELECT provider_message_id FROM {provider_messages} WHERE conversation_id = %d AND direction = 'out'", (int) $ca['id'] ) );
		// In B's topic (unmapped thread forced) reply to A's message: thread mapping
		// wins for B's topic; replying in an unknown topic to A's message is rejected.
		$this->deliver_update( $this->topic_msg( '777', 'cross', 999, array( 'reply_to_message' => array( 'message_id' => $a_msg ) ) ) );
		$this->assertSame( 0, (int) Db::var( Db::prepare( "SELECT COUNT(*) FROM {messages} WHERE author_type = 'operator'" ) ) );
		$this->assertSame( 'ignored:ambiguous_reply', Db::var( Db::prepare( 'SELECT result_code FROM {inbound_updates} ORDER BY id DESC LIMIT 1' ) ) );
	}

	public function test_group_migration_updates_destination_and_keeps_history(): void {
		$s    = $this->new_visitor_session();
		$conv = $this->start_conversation( $s );
		$this->tg->fail_next( 'createForumTopic', array( 'ok' => false, 'error_code' => 400, 'description' => 'Bad Request: group chat was upgraded to a supergroup chat', 'parameters' => array( 'migrate_to_chat_id' => -1009000000009 ) ) );
		$this->visitor_sends( $s, $conv['public_id'], 'hi' );
		$this->run_worker();
		Db::exec( Db::prepare( "UPDATE {outbox} SET available_at = %s WHERE status = 'pending'", gmdate( 'Y-m-d H:i:s', time() - 5 ) ) );
		$this->run_worker();
		$this->assertSame( '-1009000000009', Settings::get( 'telegram.destination_chat_id' ) );
		$fresh = Conversations::get( (int) $conv['id'] );
		$this->assertSame( '-1009000000009', $fresh['provider_chat_id'] );
		$this->assertSame( self::FORUM, Conversations::snapshot( $fresh )['migrated_from'] );
		$this->assertSame( 1, (int) Db::var( Db::prepare( "SELECT COUNT(*) FROM {events} WHERE event = 'routing.migrated'" ) ) );
	}
}
