<?php
/**
 * Scheduled cleanup and the shared conversation deletion routine used by
 * retention, the WordPress personal-data eraser and the admin delete action.
 *
 * Retention: conversations closed (or spam) longer than `retention_days` ago
 * are deleted with all dependent rows and files. 0 disables deletion.
 * Copies already delivered to Telegram are not deleted from Telegram.
 *
 * @package Televixo
 */

namespace Televixo\Privacy;

use Televixo\Core\Clock;
use Televixo\Core\Settings;
use Televixo\Domain\Attachments;
use Televixo\Persistence\Db;
use Televixo\Queue\Outbox;
use Televixo\Security\RateLimiter;
use Televixo\Security\SessionManager;
use Televixo\Telegram\Inbound;

defined( 'ABSPATH' ) || exit;

final class Retention {

	/**
	 * @return array<string,int>
	 */
	public static function run(): array {
		$out  = array( 'conversations' => 0 );
		$days = (int) Settings::get( 'privacy.retention_days', 365 );
		if ( $days > 0 ) {
			$ids = Db::wpdb()->get_col(
				Db::prepare(
					"SELECT id FROM {conversations} WHERE status IN ('closed','spam') AND COALESCE(closed_at, updated_at) < %s LIMIT 500",
					Clock::mysql( Clock::now() - $days * DAY_IN_SECONDS )
				)
			);
			foreach ( $ids as $id ) {
				self::delete_conversation( (int) $id );
			}
			$out['conversations'] = count( $ids );
			$out['visitors']      = Db::exec(
				Db::prepare(
					'DELETE v FROM {visitors} v LEFT JOIN {conversations} c ON c.visitor_id = v.id WHERE c.id IS NULL AND v.last_seen_at < %s',
					Clock::mysql( Clock::now() - $days * DAY_IN_SECONDS )
				)
			);
		}
		$out['events']      = Db::exec( Db::prepare( 'DELETE FROM {events} WHERE created_at < %s', Clock::mysql( Clock::now() - (int) Settings::get( 'privacy.event_retention_days', 365 ) * DAY_IN_SECONDS ) ) );
		$out['triggers']    = Db::exec( Db::prepare( 'DELETE FROM {trigger_executions} WHERE created_at < %s', Clock::mysql( Clock::now() - 180 * DAY_IN_SECONDS ) ) );
		$out['challenges']  = Db::exec( Db::prepare( 'DELETE FROM {challenges} WHERE expires_at < %s', Clock::mysql( Clock::now() - DAY_IN_SECONDS ) ) );
		$out['sessions']    = SessionManager::purge_expired();
		$out['inbound']     = Inbound::purge();
		$out['outbox']      = Outbox::purge();
		$out['rate_limits'] = RateLimiter::purge();
		$out['orphans']     = Attachments::purge_orphans();
		update_option( 'televixo_maintenance_last_run', Clock::mysql(), false );
		return $out;
	}

	public static function delete_conversation( int $id ): void {
		Attachments::delete_files_for_conversation( $id );
		Db::transaction(
			static function () use ( $id ): void {
				foreach ( array( 'messages', 'notes', 'attachments', 'participants', 'assignments', 'provider_messages', 'provider_threads', 'ratings', 'conversation_tags', 'events' ) as $table ) {
					Db::exec( Db::prepare( "DELETE FROM {{$table}} WHERE conversation_id = %d", $id ) );
				}
				Db::exec( Db::prepare( 'DELETE FROM {outbox} WHERE conversation_id = %d', $id ) );
				Db::exec( Db::prepare( 'UPDATE {trigger_executions} SET conversation_id = NULL WHERE conversation_id = %d', $id ) );
				Db::exec( Db::prepare( 'DELETE FROM {conversations} WHERE id = %d', $id ) );
			}
		);
	}

	/**
	 * Deletes a visitor with all conversations and sessions.
	 */
	public static function delete_visitor( int $visitor_id ): int {
		$ids = Db::wpdb()->get_col( Db::prepare( 'SELECT id FROM {conversations} WHERE visitor_id = %d', $visitor_id ) );
		foreach ( $ids as $id ) {
			self::delete_conversation( (int) $id );
		}
		Db::exec( Db::prepare( 'DELETE FROM {sessions} WHERE visitor_id = %d', $visitor_id ) );
		Db::exec( Db::prepare( 'DELETE FROM {trigger_executions} WHERE visitor_id = %d', $visitor_id ) );
		Db::exec( Db::prepare( 'DELETE FROM {visitors} WHERE id = %d', $visitor_id ) );
		return count( $ids );
	}
}
