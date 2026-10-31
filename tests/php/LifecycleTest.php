<?php
/**
 * Activation, migrations, deactivation, availability and retention.
 */

namespace Televixo\Tests;

use Televixo\Core\Clock;
use Televixo\Core\Lifecycle;
use Televixo\Core\Settings;
use Televixo\Domain\Availability;
use Televixo\Domain\Conversations;
use Televixo\Domain\Operators;
use Televixo\Persistence\Db;
use Televixo\Persistence\Migrator;
use Televixo\Privacy\PersonalData;
use Televixo\Privacy\Retention;
use Televixo\Queue\Scheduler;

final class LifecycleTest extends TestCase {

	public function test_activation_creates_schema_caps_and_cron(): void {
		Lifecycle::activate_site();
		$this->assertSame( array(), Migrator::missing_tables() );
		$this->assertSame( Migrator::CURRENT, Migrator::installed_version() );
		$this->assertTrue( get_role( 'administrator' )->has_cap( 'televixo_manage_settings' ) );
		$this->assertNotNull( get_role( 'televixo_operator' ) );
		$this->assertNotFalse( wp_next_scheduled( Scheduler::HOOK_WORKER ) );
		Lifecycle::deactivate();
		$this->assertFalse( wp_next_scheduled( Scheduler::HOOK_WORKER ), 'Deactivation stops scheduled work' );
		$this->assertSame( array(), Migrator::missing_tables(), 'Deactivation keeps data' );
	}

	public function test_upgrade_from_older_schema_is_idempotent(): void {
		update_option( Migrator::OPTION, 0 );
		$this->assertTrue( Migrator::needs_migration() );
		$this->assertTrue( Migrator::migrate() );
		$this->assertTrue( Migrator::migrate() );
		$this->assertSame( Migrator::CURRENT, Migrator::installed_version() );
	}

	public function test_availability_states(): void {
		Settings::update( array( 'hours' => array( 'enabled' => true, 'timezone' => 'Europe/Lisbon', 'holidays' => array( array( 'date' => '2026-12-25', 'label' => 'Xmas' ) ) ) ) );
		// Wednesday 2026-11-04 10:00 Lisbon (UTC+0 in winter) -> open, no operators.
		Clock::freeze( strtotime( '2026-11-04 10:00:00 UTC' ) );
		$this->assertSame( 'offline', Availability::status()['state'] );
		$op = $this->operator();
		Operators::set_availability( (int) $op['id'], 'online' );
		Operators::heartbeat( (int) $op['id'] );
		$this->assertSame( 'online', Availability::status()['state'] );
		// Heartbeat timeout -> not present.
		Clock::freeze( strtotime( '2026-11-04 10:05:00 UTC' ) );
		$this->assertSame( 'offline', Availability::status()['state'] );
		// Saturday -> closed, next open Monday 09:00.
		Clock::freeze( strtotime( '2026-11-07 12:00:00 UTC' ) );
		$st = Availability::status();
		$this->assertSame( 'closed', $st['state'] );
		$this->assertSame( '2026-11-09T09:00:00+00:00', $st['next_open'] );
		// Holiday.
		Clock::freeze( strtotime( '2026-12-25 10:00:00 UTC' ) );
		$this->assertSame( 'closed', Availability::status()['state'] );
		Settings::update( array( 'hours' => array( 'away' => true ) ) );
		$this->assertSame( 'away', Availability::status()['state'] );
	}

	public function test_dst_next_open(): void {
		Settings::update( array( 'hours' => array( 'enabled' => true, 'timezone' => 'America/New_York' ) ) );
		// Saturday before the US DST end (2026-11-01).
		$next = Availability::next_open( strtotime( '2026-10-31 15:00:00 UTC' ) );
		$this->assertSame( '2026-11-02 09:00', ( new \DateTime( '@' . $next ) )->setTimezone( new \DateTimeZone( 'America/New_York' ) )->format( 'Y-m-d H:i' ) );
		$this->assertSame( '2026-11-02T14:00:00+00:00', gmdate( 'c', $next ) );
	}

	public function test_retention_deletes_closed_conversations_and_files(): void {
		Settings::update( array( 'privacy' => array( 'retention_days' => 30 ) ) );
		$s   = $this->new_visitor_session();
		$old = $this->start_conversation( $s );
		$this->visitor_sends( $s, $old['public_id'], 'old' );
		Conversations::close( Conversations::get( (int) $old['id'] ), 'operator', '1' );
		Db::update( 'conversations', array( 'closed_at' => gmdate( 'Y-m-d H:i:s', time() - 40 * DAY_IN_SECONDS ) ), array( 'id' => (int) $old['id'] ) );
		$s2  = $this->new_visitor_session();
		$new = $this->start_conversation( $s2 );
		$this->visitor_sends( $s2, $new['public_id'], 'new' );
		$out = Retention::run();
		$this->assertSame( 1, $out['conversations'] );
		$this->assertNull( Conversations::get( (int) $old['id'] ) );
		$this->assertSame( 0, (int) Db::var( Db::prepare( 'SELECT COUNT(*) FROM {messages} WHERE conversation_id = %d', (int) $old['id'] ) ) );
		$this->assertNotNull( Conversations::get( (int) $new['id'] ) );
	}

	public function test_privacy_export_and_erase(): void {
		$s = $this->new_visitor_session();
		Db::update( 'visitors', array( 'email' => 'jane@example.com', 'name' => 'Jane' ), array( 'id' => (int) $s['visitor_id'] ) );
		$c = $this->start_conversation( $s );
		$this->visitor_sends( $s, $c['public_id'], 'my question' );
		$export = PersonalData::export( 'jane@example.com' );
		$this->assertStringContainsString( 'my question', wp_json_encode( $export ) );
		$erase = PersonalData::erase( 'jane@example.com' );
		$this->assertTrue( $erase['items_removed'] );
		$this->assertNotEmpty( $erase['messages'], 'Explains Telegram copies are not deleted' );
		$this->assertSame( 0, (int) Db::var( Db::prepare( 'SELECT COUNT(*) FROM {visitors}' ) ) );
		$this->assertSame( 0, (int) Db::var( Db::prepare( 'SELECT COUNT(*) FROM {messages}' ) ) );
	}

	public function test_settings_export_excludes_secrets(): void {
		$this->configure_telegram();
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
		$json = wp_json_encode( $this->rest( 'GET', '/admin/settings/export' )->get_data() );
		$this->assertStringNotContainsString( FakeTelegram::TOKEN, $json );
		$this->assertStringNotContainsString( 'test-secret-abc', $json );
		$this->assertStringContainsString( '"secrets":"excluded"', $json );
	}

	public function test_webhook_cleanup_only_removes_own_webhook(): void {
		$this->configure_telegram();
		$this->tg->webhook_url = 'https://other-site.example/hook';
		$this->assertSame( 'other', \Televixo\REST\SetupController::remove_owned_webhook() );
		$this->assertSame( 0, $this->tg->count( 'deleteWebhook' ) );
		$this->tg->webhook_url = \Televixo\REST\SetupController::webhook_url();
		$this->assertSame( 'removed', \Televixo\REST\SetupController::remove_owned_webhook() );
	}

	public function test_setup_refuses_to_replace_foreign_webhook_without_confirmation(): void {
		$this->configure_telegram();
		add_filter( 'rest_url', static fn( $u ) => str_replace( 'http://', 'https://', $u ) );
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
		$this->tg->webhook_url = 'https://other-site.example/hook';
		$res = $this->rest( 'POST', '/admin/telegram/webhook', array() );
		$this->assertSame( 409, $res->get_status() );
		$this->assertSame( 'webhook_in_use', $res->get_data()['code'] );
		$this->assertSame( 0, $this->tg->count( 'setWebhook' ) );
		$res = $this->rest( 'POST', '/admin/telegram/webhook', array( 'confirm_replace' => true ) );
		$this->assertSame( 200, $res->get_status(), wp_json_encode( $res->get_data() ) );
		$set = $this->tg->sent( 'setWebhook' )[0];
		$this->assertSame( 'test-secret-abc', $set['secret_token'] );
		$this->assertSame( array( 'message', 'callback_query', 'my_chat_member' ), $set['allowed_updates'] );
	}

	public function test_destination_checks_for_topics_mode(): void {
		$this->configure_telegram();
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
		$res = $this->rest( 'POST', '/admin/telegram/destination', array( 'chat_id' => '-1001000000001', 'mode' => 'topics' ) );
		$this->assertFalse( $res->get_data()['saved'], 'Non-forum group fails the topics check' );
		$res = $this->rest( 'POST', '/admin/telegram/destination', array( 'chat_id' => '-1001000000002', 'mode' => 'topics' ) );
		$this->assertTrue( $res->get_data()['saved'], wp_json_encode( $res->get_data() ) );
		$this->assertSame( 'topics', Settings::get( 'telegram.routing_mode' ) );
	}
}
