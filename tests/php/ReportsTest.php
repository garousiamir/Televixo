<?php
/**
 * Report metric definitions.
 */

namespace Televixo\Tests;

use Televixo\Domain\Conversations;
use Televixo\Domain\Messages;
use Televixo\Persistence\Db;
use Televixo\Reporting\Reports;

final class ReportsTest extends TestCase {

	public function test_metrics_exclude_automation_and_spam(): void {
		$op = $this->operator();
		update_option( 'timezone_string', 'UTC' );
		// Conversation 1: visitor at T, automation at T+5, human at T+120, closed at T+600.
		$s1 = $this->new_visitor_session();
		$c1 = $this->start_conversation( $s1 );
		$this->visitor_sends( $s1, $c1['public_id'], 'help' );
		Messages::create_automation_message( Conversations::get( (int) $c1['id'] ), 'bot reply' );
		$this->assertNull( Conversations::get( (int) $c1['id'] )['first_human_response_at'], 'Automation is not a human response' );
		Messages::create_operator_message( Conversations::get( (int) $c1['id'] ), $op, 'human reply', 'admin' );
		$t = time();
		Db::exec( Db::prepare( "UPDATE {messages} SET created_at = %s WHERE conversation_id = %d AND author_type = 'visitor'", gmdate( 'Y-m-d H:i:s', $t - 120 ), (int) $c1['id'] ) );
		Db::update( 'conversations', array( 'first_human_response_at' => gmdate( 'Y-m-d H:i:s', $t ), 'created_at' => gmdate( 'Y-m-d H:i:s', $t - 130 ) ), array( 'id' => (int) $c1['id'] ) );
		$closed = Conversations::close( Conversations::get( (int) $c1['id'] ), 'operator', '1' );
		Db::update( 'conversations', array( 'closed_at' => gmdate( 'Y-m-d H:i:s', $t + 470 ) ), array( 'id' => (int) $c1['id'] ) );
		// Conversation 2: unanswered.
		$s2 = $this->new_visitor_session();
		$c2 = $this->start_conversation( $s2 );
		$this->visitor_sends( $s2, $c2['public_id'], 'anyone?' );
		// Conversation 3: spam (excluded).
		$s3 = $this->new_visitor_session();
		$c3 = $this->start_conversation( $s3 );
		$this->visitor_sends( $s3, $c3['public_id'], 'spam' );
		Conversations::mark_spam( Conversations::get( (int) $c3['id'] ), 'operator', '1' );
		Db::insert( 'ratings', array( 'conversation_id' => (int) $c1['id'], 'visitor_id' => (int) $s1['visitor_id'], 'score' => 5, 'comment' => '', 'created_at' => gmdate( 'Y-m-d H:i:s' ) ) );

		$r = Reports::summary( gmdate( 'Y-m-d', time() - DAY_IN_SECONDS ), gmdate( 'Y-m-d', time() + DAY_IN_SECONDS ) );
		$this->assertSame( 2, $r['conversations'] );
		$this->assertSame( 1, $r['unanswered'] );
		$this->assertSame( 120, $r['first_response']['median'] );
		$this->assertSame( 600, $r['resolution']['median'] );
		$this->assertSame( 5.0, $r['csat']['average'] );
		$this->assertSame( 1.0, $r['csat']['satisfied_share'] );
	}

	public function test_stats_median(): void {
		$this->assertSame( array( 'count' => 4, 'median' => 25, 'mean' => 40 ), Reports::stats( array( 10, 20, 30, 100 ) ) );
		$this->assertSame( array( 'count' => 0, 'median' => null, 'mean' => null ), Reports::stats( array() ) );
	}
}
