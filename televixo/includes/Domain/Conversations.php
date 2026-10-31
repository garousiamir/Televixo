<?php
/**
 * Conversation lifecycle, ownership and routing snapshots.
 *
 * @package Televixo
 */

namespace Televixo\Domain;

use Televixo\Core\Clock;
use Televixo\Core\Settings;
use Televixo\Persistence\Db;
use Televixo\Security\Random;

defined( 'ABSPATH' ) || exit;

final class Conversations {

	/**
	 * @return array<string,mixed>|null
	 */
	public static function get( int $id ): ?array {
		return Db::row( Db::prepare( 'SELECT * FROM {conversations} WHERE id = %d', $id ) );
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function by_public_id( string $public_id ): ?array {
		return Db::row( Db::prepare( 'SELECT * FROM {conversations} WHERE public_id = %s', $public_id ) );
	}

	/**
	 * Ownership-checked lookup for visitor routes. Returns the same error for
	 * "does not exist" and "belongs to someone else" to prevent enumeration.
	 *
	 * @return array<string,mixed>
	 * @throws DomainException When not owned.
	 */
	public static function for_visitor( string $public_id, int $visitor_id ): array {
		$row = self::by_public_id( $public_id );
		if ( ! $row || (int) $row['visitor_id'] !== $visitor_id ) {
			throw new DomainException( 'conversation_not_found', __( 'Conversation not found.', 'televixo' ), 404 );
		}
		return $row;
	}

	/**
	 * @return array<string,mixed>|null Most recent active conversation.
	 */
	public static function active_for_visitor( int $visitor_id ): ?array {
		return Db::row(
			Db::prepare(
				"SELECT * FROM {conversations} WHERE visitor_id = %d AND status NOT IN ('closed','spam') ORDER BY id DESC LIMIT 1",
				$visitor_id
			)
		);
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function latest_for_visitor( int $visitor_id ): ?array {
		return Db::row( Db::prepare( 'SELECT * FROM {conversations} WHERE visitor_id = %d ORDER BY id DESC LIMIT 1', $visitor_id ) );
	}

	/**
	 * Builds the immutable routing snapshot for a new conversation. Changing
	 * the global defaults later never rewrites existing snapshots.
	 *
	 * @return array<string,mixed>
	 */
	public static function routing_snapshot( int $team_id = 0 ): array {
		$t    = Settings::get( 'telegram' );
		$chat = (string) $t['destination_chat_id'];
		if ( $team_id ) {
			$team_chat = (string) Db::var( Db::prepare( 'SELECT destination_chat_id FROM {teams} WHERE id = %d', $team_id ) );
			if ( '' !== $team_chat ) {
				$chat = $team_chat;
			}
		}
		return array(
			'version'        => 1,
			'provider'       => 'telegram',
			'mode'           => (string) $t['routing_mode'],
			'account'        => (string) $t['bot_id'],
			'chat_id'        => $chat,
			'context_fields' => array_values( (array) $t['context_fields'] ),
			'forwarding'     => (string) $t['topic_forwarding'],
			'note_prefix'    => (string) $t['note_prefix'],
			'captured_at'    => Clock::mysql(),
		);
	}

	/**
	 * @return array<string,mixed>
	 */
	public static function snapshot( array $conversation ): array {
		$s = json_decode( (string) $conversation['routing_snapshot'], true );
		return is_array( $s ) ? $s : array();
	}

	/**
	 * Starts a conversation or resumes the visitor's active one.
	 *
	 * @param array<string,mixed> $context Sanitized page context.
	 * @return array<string,mixed>
	 */
	public static function start( int $visitor_id, string $department = '', array $context = array(), bool $offline = false ): array {
		$active = self::active_for_visitor( $visitor_id );
		if ( $active && ! $offline ) {
			return $active;
		}
		$team_id = self::team_for_department( $department );
		$snap    = self::routing_snapshot( $team_id );
		$now     = Clock::mysql();
		$id      = Db::transaction(
			static function () use ( $visitor_id, $department, $context, $offline, $team_id, $snap, $now ): int {
				$id = Db::insert(
					'conversations',
					array(
						'public_id'        => Random::public_id(),
						'reference'        => Random::reference(),
						'visitor_id'       => $visitor_id,
						'status'           => ConversationStatus::Pending->value,
						'is_offline'       => $offline ? 1 : 0,
						'department'       => $department,
						'team_id'          => $team_id ?: null,
						'routing_mode'     => $snap['mode'],
						'routing_snapshot' => wp_json_encode( $snap ),
						'provider_account' => $snap['account'],
						'provider_chat_id' => $snap['chat_id'],
						'context'          => wp_json_encode( $context ),
						'last_message_at'  => $now,
						'created_at'       => $now,
						'updated_at'       => $now,
					)
				);
				Db::insert_ignore_duplicate(
					'participants',
					array(
						'conversation_id'  => $id,
						'participant_type' => 'visitor',
						'participant_ref'  => $visitor_id,
						'joined_at'        => $now,
					)
				);
				Events::record(
					'conversation.created',
					'visitor',
					(string) $visitor_id,
					$id,
					'',
					'',
					array(
						'mode'    => $snap['mode'],
						'offline' => $offline,
					)
				);
				return $id;
			}
		);
		return self::get( $id ) ?? array();
	}

	public static function team_for_department( string $department ): int {
		if ( '' !== $department ) {
			foreach ( (array) Settings::get( 'prechat.departments', array() ) as $dep ) {
				if ( $dep['key'] === $department && ! empty( $dep['team_id'] ) ) {
					return (int) $dep['team_id'];
				}
			}
		}
		return (int) Settings::get( 'routing.default_team_id', 0 );
	}

	/**
	 * Validated state transition, conditional on the state the caller saw so
	 * concurrent writers cannot clobber each other.
	 *
	 * @param array<string,mixed> $extra Additional columns.
	 * @throws DomainException On invalid transition or concurrent change.
	 */
	public static function transition( array $conversation, ConversationStatus $next, string $actor_type, string $actor_ref, array $extra = array() ): array {
		$current = ConversationStatus::from( (string) $conversation['status'] );
		if ( $current === $next && ! $extra ) {
			return $conversation;
		}
		if ( $current !== $next && ! $current->can_transition_to( $next ) ) {
			throw new DomainException( 'invalid_transition', sprintf( 'Cannot move from %s to %s.', $current->value, $next->value ), 409 );
		}
		$data = array_merge(
			$extra,
			array(
				'status'     => $next->value,
				'updated_at' => Clock::mysql(),
			)
		);
		if ( ConversationStatus::Closed === $next ) {
			$data['closed_at'] = Clock::mysql();
			$data['closed_by'] = $actor_type;
		}
		if ( ConversationStatus::Reopened === $next ) {
			$data['reopened_count'] = (int) $conversation['reopened_count'] + 1;
			$data['closed_at']      = null;
		}
		if ( ConversationStatus::Queued === $next && empty( $conversation['queued_at'] ) ) {
			$data['queued_at'] = Clock::mysql();
		}
		$sets = array();
		foreach ( $data as $col => $val ) {
			$sets[] = null === $val ? "`$col` = NULL" : Db::prepare( "`$col` = %s", (string) $val );
		}
		$n = Db::exec(
			Db::prepare( 'UPDATE {conversations} SET ' . implode( ', ', $sets ) . ' WHERE id = %d AND status = %s', (int) $conversation['id'], $current->value )
		);
		if ( 0 === $n ) {
			$fresh = self::get( (int) $conversation['id'] );
			if ( $fresh && $fresh['status'] === $next->value ) {
				return $fresh;
			}
			throw new DomainException( 'conflict', __( 'The conversation was changed by someone else. Reload and try again.', 'televixo' ), 409 );
		}
		if ( $current !== $next ) {
			Events::record(
				'conversation.status',
				$actor_type,
				$actor_ref,
				(int) $conversation['id'],
				'',
				'',
				array(
					'from' => $current->value,
					'to'   => $next->value,
				)
			);
			do_action( 'televixo_conversation_status_changed', (int) $conversation['id'], $current->value, $next->value );
		}
		return self::get( (int) $conversation['id'] ) ?? $conversation;
	}

	/**
	 * @throws DomainException On invalid state.
	 */
	public static function close( array $conversation, string $actor_type, string $actor_ref ): array {
		if ( ConversationStatus::Closed->value === $conversation['status'] ) {
			return $conversation;
		}
		$closed = self::transition( $conversation, ConversationStatus::Closed, $actor_type, $actor_ref );
		Db::exec( Db::prepare( 'UPDATE {assignments} SET ended_at = %s WHERE conversation_id = %d AND ended_at IS NULL', Clock::mysql(), (int) $conversation['id'] ) );
		if ( 'topics' === $closed['routing_mode'] && '' !== $closed['provider_thread_id'] ) {
			\Televixo\Queue\Outbox::enqueue( 'telegram.topic_state', 'conv:' . $closed['id'], array( 'state' => 'closed' ), (int) $closed['id'] );
		}
		return $closed;
	}

	public static function mark_spam( array $conversation, string $actor_type, string $actor_ref ): array {
		$c = self::transition( $conversation, ConversationStatus::Spam, $actor_type, $actor_ref );
		// Undelivered visitor messages in a spam conversation are not relayed.
		Db::exec(
			Db::prepare(
				"UPDATE {outbox} SET status = 'cancelled', updated_at = %s WHERE conversation_id = %d AND status IN ('pending','uncertain')",
				Clock::mysql(),
				(int) $conversation['id']
			)
		);
		return $c;
	}

	/**
	 * @param array<string,mixed> $conversation
	 * @return array<string,mixed>
	 */
	public static function context( array $conversation ): array {
		$c = json_decode( (string) ( $conversation['context'] ?? '' ), true );
		return is_array( $c ) ? $c : array();
	}

	public static function set_typing( int $conversation_id, string $side ): void {
		$col = 'visitor' === $side ? 'visitor_typing_until' : 'operator_typing_until';
		Db::exec( Db::prepare( "UPDATE {conversations} SET `$col` = %s WHERE id = %d", Clock::mysql( Clock::now() + 6 ), $conversation_id ) );
	}

	public static function mark_read( int $conversation_id, string $side, int $message_id ): void {
		$col = 'visitor' === $side ? 'visitor_read_id' : 'operator_read_id';
		// Read markers only move forward.
		Db::exec( Db::prepare( "UPDATE {conversations} SET `$col` = GREATEST(`$col`, %d) WHERE id = %d", $message_id, $conversation_id ) );
	}

	public static function migrate_routing( int $conversation_id, string $new_chat_id, string $reason ): void {
		$conv = self::get( $conversation_id );
		if ( ! $conv ) {
			return;
		}
		$snap                  = self::snapshot( $conv );
		$snap['migrated_from'] = $snap['chat_id'] ?? '';
		$snap['chat_id']       = $new_chat_id;
		$snap['migrated_at']   = Clock::mysql();
		Db::update(
			'conversations',
			array(
				'routing_snapshot' => wp_json_encode( $snap ),
				'provider_chat_id' => $new_chat_id,
				'updated_at'       => Clock::mysql(),
			),
			array( 'id' => $conversation_id )
		);
		Events::record(
			'routing.migrated',
			'system',
			'',
			$conversation_id,
			'',
			'',
			array(
				'from'   => $snap['migrated_from'],
				'to'     => $new_chat_id,
				'reason' => $reason,
			)
		);
	}
}
