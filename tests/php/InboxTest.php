<?php
/**
 * Admin inbox authorization, claims, transfers, routing strategies.
 */

namespace Televixo\Tests;

use Televixo\Core\Settings;
use Televixo\Domain\Assignment;
use Televixo\Domain\Conversations;
use Televixo\Domain\DomainException;
use Televixo\Domain\Operators;
use Televixo\Persistence\Db;
use Televixo\Security\Capabilities;

final class InboxTest extends TestCase {

	public function test_capabilities_enforced_server_side(): void {
		$s = $this->new_visitor_session();
		$c = $this->start_conversation( $s );
		wp_set_current_user( 0 );
		$this->assertSame( 401, $this->rest( 'GET', '/admin/conversations' )->get_status() );
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'subscriber' ) ) );
		$this->assertSame( 403, $this->rest( 'GET', '/admin/conversations' )->get_status() );
		$this->assertSame( 403, $this->rest( 'GET', "/admin/conversations/{$c['public_id']}" )->get_status() );

		$op = $this->operator( '', Capabilities::OPERATOR_ROLE, 'Agent' );
		wp_set_current_user( (int) $op['wp_user_id'] );
		$this->assertSame( 200, $this->rest( 'GET', '/admin/conversations' )->get_status() );
		$this->assertSame( 403, $this->rest( 'GET', '/admin/settings' )->get_status(), 'Operators cannot read settings' );
		$this->assertSame( 403, $this->rest( 'GET', '/admin/reports' )->get_status() );
		$this->assertSame( 403, $this->rest( 'DELETE', "/admin/conversations/{$c['public_id']}" )->get_status() );
	}

	public function test_operator_scope_assigned_unassigned_and_teams(): void {
		$agent = $this->operator( '', Capabilities::OPERATOR_ROLE, 'Agent' );
		$other = $this->operator( '', Capabilities::OPERATOR_ROLE, 'Other' );
		$team  = Db::insert( 'teams', array( 'name' => 'Sales', 'slug' => 'sales', 'created_at' => gmdate( 'Y-m-d H:i:s' ), 'updated_at' => gmdate( 'Y-m-d H:i:s' ) ) );
		$mine   = $this->start_conversation( $this->new_visitor_session() );
		$theirs = $this->start_conversation( $this->new_visitor_session() );
		$sales  = $this->start_conversation( $this->new_visitor_session() );
		Assignment::claim( $mine, $agent );
		Assignment::claim( $theirs, $other );
		Db::update( 'conversations', array( 'team_id' => $team ), array( 'id' => (int) $sales['id'] ) );

		wp_set_current_user( (int) $agent['wp_user_id'] );
		$ids = array_column( $this->rest( 'GET', '/admin/conversations' )->get_data()['items'], 'id' );
		$this->assertContains( $mine['public_id'], $ids );
		$this->assertNotContains( $theirs['public_id'], $ids );
		$this->assertNotContains( $sales['public_id'], $ids, 'Unassigned conversations of other teams are hidden' );
		$this->assertSame( 404, $this->rest( 'GET', "/admin/conversations/{$theirs['public_id']}/messages" )->get_status() );
		$this->assertSame( 404, $this->rest( 'POST', "/admin/conversations/{$theirs['public_id']}/messages", array( 'body' => 'x' ) )->get_status() );

		Db::insert( 'team_members', array( 'team_id' => $team, 'operator_id' => (int) $agent['id'] ) );
		$ids = array_column( $this->rest( 'GET', '/admin/conversations' )->get_data()['items'], 'id' );
		$this->assertContains( $sales['public_id'], $ids );
	}

	public function test_concurrent_claim_has_exactly_one_winner(): void {
		$a = $this->operator( '', Capabilities::OPERATOR_ROLE, 'A' );
		$b = $this->operator( '', Capabilities::OPERATOR_ROLE, 'B' );
		$c = $this->start_conversation( $this->new_visitor_session() );
		// Both operators loaded the same unassigned snapshot.
		$snapshot = Conversations::get( (int) $c['id'] );
		Assignment::claim( $snapshot, $a );
		try {
			Assignment::claim( $snapshot, $b );
			$this->fail( 'Second claim must conflict' );
		} catch ( DomainException $e ) {
			$this->assertSame( 'already_claimed', $e->error_code );
			$this->assertSame( 409, $e->status );
		}
		$this->assertSame( (int) $a['id'], (int) Conversations::get( (int) $c['id'] )['assigned_operator_id'] );
		$this->assertSame( 1, (int) Db::var( Db::prepare( 'SELECT COUNT(*) FROM {assignments} WHERE conversation_id = %d', (int) $c['id'] ) ) );
		// Repeating the winner's claim is idempotent.
		Assignment::claim( $snapshot, $a );
		$this->assertSame( 1, (int) Db::var( Db::prepare( 'SELECT COUNT(*) FROM {assignments} WHERE conversation_id = %d', (int) $c['id'] ) ) );
	}

	public function test_transfer_is_conditional_on_current_assignee(): void {
		$a = $this->operator( '', Capabilities::OPERATOR_ROLE, 'A' );
		$b = $this->operator( '', Capabilities::OPERATOR_ROLE, 'B' );
		$x = $this->operator( '', Capabilities::OPERATOR_ROLE, 'X' );
		$c = $this->start_conversation( $this->new_visitor_session() );
		$stale = Assignment::claim( $c, $a );
		Assignment::transfer( $stale, (int) $b['id'], 'user', 1 );
		$this->expectException( DomainException::class );
		Assignment::transfer( $stale, (int) $x['id'], 'user', 1 ); // based on stale assignee A
	}

	public function test_round_robin_and_load_strategies_use_present_operators(): void {
		Settings::update( array( 'routing' => array( 'strategy' => 'round_robin' ) ) );
		$a = $this->operator( '', Capabilities::OPERATOR_ROLE, 'A' );
		$b = $this->operator( '', Capabilities::OPERATOR_ROLE, 'B' );
		$c = $this->operator( '', Capabilities::OPERATOR_ROLE, 'Absent' );
		foreach ( array( $a, $b ) as $op ) {
			Operators::set_availability( (int) $op['id'], 'online' );
			Operators::heartbeat( (int) $op['id'] );
		}
		$assigned = array();
		for ( $i = 0; $i < 4; $i++ ) {
			$s = $this->new_visitor_session();
			$conv = $this->start_conversation( $s );
			$this->visitor_sends( $s, $conv['public_id'], 'hi' );
			$assigned[] = (int) Conversations::get( (int) $conv['id'] )['assigned_operator_id'];
		}
		$this->assertNotContains( (int) $c['id'], $assigned, 'Absent operators are never auto-assigned' );
		$counts = array_count_values( $assigned );
		$this->assertSame( 2, $counts[ (int) $a['id'] ] ?? 0 );
		$this->assertSame( 2, $counts[ (int) $b['id'] ] ?? 0 );

		Settings::update( array( 'routing' => array( 'strategy' => 'load' ) ) );
		Db::update( 'operators', array( 'max_concurrent' => 2 ), array( 'id' => (int) $a['id'] ) );
		Db::update( 'operators', array( 'max_concurrent' => 2 ), array( 'id' => (int) $b['id'] ) );
		$s    = $this->new_visitor_session();
		$conv = $this->start_conversation( $s );
		$this->visitor_sends( $s, $conv['public_id'], 'hi' );
		$this->assertNull( Conversations::get( (int) $conv['id'] )['assigned_operator_id'], 'Capacity full: stays queued' );
		$this->assertSame( 'queued', Conversations::get( (int) $conv['id'] )['status'] );
	}

	public function test_inbox_cursor_pagination_and_unread(): void {
		$op = $this->operator();
		wp_set_current_user( 0 );
		for ( $i = 0; $i < 7; $i++ ) {
			$s = $this->new_visitor_session( "Person-$i" );
			$c = $this->start_conversation( $s );
			$this->visitor_sends( $s, $c['public_id'], "msg $i" );
			Db::update( 'conversations', array( 'last_message_at' => gmdate( 'Y-m-d H:i:s', time() - 100 + $i ) ), array( 'id' => (int) $c['id'] ) );
		}
		wp_set_current_user( (int) $op['wp_user_id'] );
		$page1 = $this->rest( 'GET', '/admin/conversations', array( 'limit' => 3 ) )->get_data();
		$page2 = $this->rest( 'GET', '/admin/conversations', array( 'limit' => 3, 'cursor' => $page1['next_cursor'] ) )->get_data();
		$page3 = $this->rest( 'GET', '/admin/conversations', array( 'limit' => 3, 'cursor' => $page2['next_cursor'] ) )->get_data();
		$names = array_map( static fn( $i ) => $i['visitor']['name'], array_merge( $page1['items'], $page2['items'], $page3['items'] ) );
		$this->assertSame( array( "Person-6", "Person-5", "Person-4", "Person-3", "Person-2", "Person-1", "Person-0" ), $names );
		$this->assertNull( $page3['next_cursor'] );
		$this->assertSame( 7, $page1['unread'] );
		$this->assertSame( 1, $page1['items'][0]['unread'] );
		$search = $this->rest( 'GET', '/admin/conversations', array( "q" => "Person-3" ) )->get_data();
		$this->assertCount( 1, $search['items'] );
	}

	public function test_state_machine_rejects_invalid_transitions(): void {
		$c = $this->start_conversation( $this->new_visitor_session() );
		$c = Conversations::close( $c, 'operator', '1' );
		$this->expectException( DomainException::class );
		Conversations::transition( $c, \Televixo\Domain\ConversationStatus::Waiting, 'operator', '1' );
	}

	public function test_visitor_message_after_close_reopens(): void {
		$s = $this->new_visitor_session();
		$c = $this->start_conversation( $s );
		$this->visitor_sends( $s, $c['public_id'], 'first' );
		Conversations::close( Conversations::get( (int) $c['id'] ), 'operator', '1' );
		$this->use_session( $s );
		// A new conversation is started by the widget after closure; the old
		// one can still receive a message and becomes reopened.
		$this->visitor_sends( $s, $c['public_id'], 'again' );
		$fresh = Conversations::get( (int) $c['id'] );
		$this->assertSame( 'reopened', $fresh['status'] );
		$this->assertSame( 1, (int) $fresh['reopened_count'] );
	}

	public function test_spam_stops_relay(): void {
		$this->configure_telegram();
		$s = $this->new_visitor_session();
		$c = $this->start_conversation( $s );
		Conversations::mark_spam( $c, 'operator', '1' );
		$this->visitor_sends( $s, $c['public_id'], 'buy pills' );
		$this->run_worker();
		$this->assertSame( 0, $this->tg->count( 'sendMessage' ) );
	}
}
