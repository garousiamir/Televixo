<?php
/**
 * Message creation and cursor-paginated reads.
 *
 * Visitor messages and their outbox jobs are written in one InnoDB
 * transaction, so a stored message always has a delivery job and a failed
 * write leaves neither.
 *
 * @package Televixo
 */

namespace Televixo\Domain;

use Televixo\Core\Clock;
use Televixo\Core\Settings;
use Televixo\Persistence\Db;
use Televixo\Queue\Outbox;
use Televixo\Security\Random;

defined( 'ABSPATH' ) || exit;

final class Messages {

	public const PAGE_MAX = 50;

	/**
	 * @param int[] $attachment_ids Internal IDs already verified by the caller.
	 * @return array{message:array<string,mixed>,duplicate:bool}
	 * @throws DomainException On validation errors.
	 */
	public static function create_visitor_message( array $conversation, int $visitor_id, string $body, string $client_key, array $attachment_ids = array() ): array {
		$body = self::normalize_body( $body );
		if ( '' === $body && ! $attachment_ids ) {
			throw new DomainException( 'message_empty', __( 'Message is empty.', 'televixo' ) );
		}
		if ( mb_strlen( $body ) > (int) Settings::get( 'limits.max_message_chars', 4000 ) ) {
			throw new DomainException( 'message_too_long', __( 'Message is too long.', 'televixo' ), 413 );
		}
		if ( ! preg_match( '/^[A-Za-z0-9_-]{8,64}$/', $client_key ) ) {
			throw new DomainException( 'invalid_client_id', __( 'Invalid message identifier.', 'televixo' ) );
		}
		$idem = hash( 'sha256', 'visitor|' . $visitor_id . '|' . $client_key );

		$existing = self::by_idempotency( $idem );
		if ( $existing ) {
			return array( 'message' => $existing, 'duplicate' => true );
		}

		$result = Db::transaction(
			static function () use ( $conversation, $visitor_id, $body, $idem, $attachment_ids ): array {
				$now   = Clock::mysql();
				$fresh = Conversations::get( (int) $conversation['id'] );
				if ( ! $fresh ) {
					throw new DomainException( 'conversation_not_found', __( 'Conversation not found.', 'televixo' ), 404 );
				}
				$status   = ConversationStatus::from( (string) $fresh['status'] );
				$is_spam  = ConversationStatus::Spam === $status;
				$relay    = ! $is_spam && self::relay_enabled( $fresh );
				$id       = Db::insert_ignore_duplicate(
					'messages',
					array(
						'public_id'       => Random::public_id(),
						'conversation_id' => (int) $fresh['id'],
						'author_type'     => 'visitor',
						'author_ref'      => $visitor_id,
						'author_name'     => '',
						'source'          => 'web',
						'body'            => $body,
						'idempotency_key' => $idem,
						'delivery_state'  => $relay ? DeliveryState::Queued->value : DeliveryState::LocalAccepted->value,
						'created_at'      => $now,
					)
				);
				if ( 0 === $id ) {
					return array( 'id' => (int) Db::var( Db::prepare( 'SELECT id FROM {messages} WHERE idempotency_key = %s', $idem ) ), 'duplicate' => true );
				}
				if ( $attachment_ids ) {
					Db::exec(
						Db::prepare(
							"UPDATE {attachments} SET message_id = %d, status = 'ready' WHERE conversation_id = %d AND uploader_type = 'visitor' AND uploader_ref = %d AND message_id IS NULL AND id IN (" . Db::in_ints( $attachment_ids ) . ')',
							$id,
							(int) $fresh['id'],
							$visitor_id
						)
					);
				}
				$next  = $status->after_visitor_message();
				$extra = array(
					'last_message_id'         => $id,
					'last_message_at'         => $now,
					'last_visitor_message_at' => $now,
				);
				Conversations::transition( $fresh, $next, 'visitor', (string) $visitor_id, $extra );
				if ( $relay ) {
					Outbox::enqueue( 'telegram.deliver', 'conv:' . $fresh['id'], array( 'message_id' => $id ), (int) $fresh['id'], $id );
				}
				return array( 'id' => $id, 'duplicate' => false, 'became' => $next->value, 'was' => $status->value );
			}
		);

		$message = self::get( (int) $result['id'] );
		if ( ! $result['duplicate'] ) {
			do_action( 'televixo_visitor_message_created', $message, $conversation );
			if ( isset( $result['was'] ) && in_array( $result['was'], array( 'pending', 'closed' ), true ) ) {
				Assignment::auto_assign( (int) $conversation['id'] );
			}
		}
		return array( 'message' => $message ?? array(), 'duplicate' => (bool) $result['duplicate'] );
	}

	/**
	 * Public reply by a human operator (from Telegram or the WordPress inbox).
	 *
	 * @param array<string,mixed> $operator Operator row.
	 * @param int[]               $attachment_ids
	 * @return array<string,mixed> Message row.
	 */
	public static function create_operator_message( array $conversation, array $operator, string $body, string $source, array $attachment_ids = array(), bool $mirror_to_provider = false ): array {
		$body = self::normalize_body( $body );
		if ( '' === $body && ! $attachment_ids ) {
			throw new DomainException( 'message_empty', __( 'Message is empty.', 'televixo' ) );
		}
		if ( ConversationStatus::Spam->value === $conversation['status'] ) {
			throw new DomainException( 'conversation_spam', __( 'This conversation is marked as spam.', 'televixo' ), 409 );
		}
		$id = Db::transaction(
			static function () use ( $conversation, $operator, $body, $source, $attachment_ids, $mirror_to_provider ): int {
				$now   = Clock::mysql();
				$fresh = Conversations::get( (int) $conversation['id'] ) ?? $conversation;
				$id    = Db::insert(
					'messages',
					array(
						'public_id'       => Random::public_id(),
						'conversation_id' => (int) $fresh['id'],
						'author_type'     => 'operator',
						'author_ref'      => (int) $operator['id'],
						'author_name'     => mb_substr( (string) $operator['display_name'], 0, 190 ),
						'source'          => $source,
						'body'            => $body,
						'delivery_state'  => $mirror_to_provider ? DeliveryState::Queued->value : DeliveryState::NotApplicable->value,
						'created_at'      => $now,
					)
				);
				if ( $attachment_ids ) {
					Db::exec(
						Db::prepare(
							"UPDATE {attachments} SET message_id = %d, status = 'ready' WHERE conversation_id = %d AND uploader_type = 'operator' AND message_id IS NULL AND id IN (" . Db::in_ints( $attachment_ids ) . ')',
							$id,
							(int) $fresh['id']
						)
					);
				}
				$status = ConversationStatus::from( (string) $fresh['status'] );
				if ( ConversationStatus::Closed === $status ) {
					$fresh  = Conversations::transition( $fresh, ConversationStatus::Reopened, 'operator', (string) $operator['id'] );
					$status = ConversationStatus::Reopened;
				}
				$extra = array(
					'last_message_id' => $id,
					'last_message_at' => $now,
					'human_engaged'   => 1,
				);
				if ( empty( $fresh['first_human_response_at'] ) ) {
					$extra['first_human_response_at'] = $now;
				}
				Conversations::transition( $fresh, $status->after_operator_reply(), 'operator', (string) $operator['id'], $extra );
				Db::insert_ignore_duplicate(
					'participants',
					array(
						'conversation_id'  => (int) $fresh['id'],
						'participant_type' => 'operator',
						'participant_ref'  => (int) $operator['id'],
						'joined_at'        => $now,
					)
				);
				Conversations::mark_read( (int) $fresh['id'], 'operator', $id );
				if ( $mirror_to_provider ) {
					Outbox::enqueue( 'telegram.mirror', 'conv:' . $fresh['id'], array( 'message_id' => $id ), (int) $fresh['id'], $id );
				}
				return $id;
			}
		);
		$message = self::get( $id ) ?? array();
		do_action( 'televixo_operator_message_created', $message, $conversation );
		return $message;
	}

	/**
	 * Clearly identified automated message (welcome flows, triggers).
	 *
	 * @return array<string,mixed>
	 */
	public static function create_automation_message( array $conversation, string $body, string $label = '' ): array {
		$now = Clock::mysql();
		$id  = Db::insert(
			'messages',
			array(
				'public_id'       => Random::public_id(),
				'conversation_id' => (int) $conversation['id'],
				'author_type'     => 'automation',
				'author_name'     => mb_substr( $label, 0, 190 ),
				'source'          => 'automation',
				'body'            => self::normalize_body( $body ),
				'delivery_state'  => DeliveryState::NotApplicable->value,
				'created_at'      => $now,
			)
		);
		Db::update( 'conversations', array( 'last_message_id' => $id, 'last_message_at' => $now ), array( 'id' => (int) $conversation['id'] ) );
		return self::get( $id ) ?? array();
	}

	/**
	 * Internal note: stored in a separate table so no visitor query can read it.
	 *
	 * @return array<string,mixed>
	 */
	public static function create_note( array $conversation, ?array $operator, string $body, string $source ): array {
		$body = self::normalize_body( $body );
		if ( '' === $body ) {
			throw new DomainException( 'message_empty', __( 'Note is empty.', 'televixo' ) );
		}
		$id = Db::insert(
			'notes',
			array(
				'conversation_id' => (int) $conversation['id'],
				'operator_id'     => $operator ? (int) $operator['id'] : null,
				'author_name'     => $operator ? mb_substr( (string) $operator['display_name'], 0, 190 ) : '',
				'source'          => $source,
				'body'            => $body,
				'created_at'      => Clock::mysql(),
			)
		);
		return Db::row( Db::prepare( 'SELECT * FROM {notes} WHERE id = %d', $id ) ) ?? array();
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function notes( int $conversation_id, int $limit = 100 ): array {
		return Db::rows( Db::prepare( 'SELECT * FROM {notes} WHERE conversation_id = %d ORDER BY id DESC LIMIT %d', $conversation_id, min( 200, $limit ) ) );
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function get( int $id ): ?array {
		return Db::row( Db::prepare( 'SELECT * FROM {messages} WHERE id = %d', $id ) );
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function by_idempotency( string $hash ): ?array {
		return Db::row( Db::prepare( 'SELECT * FROM {messages} WHERE idempotency_key = %s', $hash ) );
	}

	/**
	 * Cursor page. `after` returns ascending newer messages; `before` returns
	 * the previous page (still sorted ascending in the result).
	 *
	 * @return array{items:array<int,array<string,mixed>>,has_more:bool}
	 */
	public static function page( int $conversation_id, int $after = 0, int $before = 0, int $limit = 30 ): array {
		$limit = max( 1, min( self::PAGE_MAX, $limit ) );
		if ( $before > 0 ) {
			$rows = Db::rows( Db::prepare( 'SELECT * FROM {messages} WHERE conversation_id = %d AND id < %d ORDER BY id DESC LIMIT %d', $conversation_id, $before, $limit + 1 ) );
			$more = count( $rows ) > $limit;
			$rows = array_reverse( array_slice( $rows, 0, $limit ) );
		} elseif ( $after > 0 ) {
			$rows = Db::rows( Db::prepare( 'SELECT * FROM {messages} WHERE conversation_id = %d AND id > %d ORDER BY id ASC LIMIT %d', $conversation_id, $after, $limit + 1 ) );
			$more = count( $rows ) > $limit;
			$rows = array_slice( $rows, 0, $limit );
		} else {
			$rows = Db::rows( Db::prepare( 'SELECT * FROM {messages} WHERE conversation_id = %d ORDER BY id DESC LIMIT %d', $conversation_id, $limit + 1 ) );
			$more = count( $rows ) > $limit;
			$rows = array_reverse( array_slice( $rows, 0, $limit ) );
		}
		return array( 'items' => $rows, 'has_more' => $more );
	}

	public static function set_delivery( int $message_id, DeliveryState $state, string $error = '' ): void {
		Db::update( 'messages', array( 'delivery_state' => $state->value, 'delivery_error' => substr( $error, 0, 64 ) ), array( 'id' => $message_id ) );
	}

	public static function normalize_body( string $body ): string {
		$body = str_replace( array( "\r\n", "\r" ), "\n", $body );
		// Strip control characters except newline and tab; keep emoji and RTL marks.
		$body = (string) preg_replace( '/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $body );
		$body = wp_check_invalid_utf8( $body, true );
		return trim( $body );
	}

	/**
	 * Whether visitor messages are relayed to Telegram for this conversation.
	 */
	public static function relay_enabled( array $conversation ): bool {
		$snap = Conversations::snapshot( $conversation );
		return '' !== ( $snap['chat_id'] ?? '' ) && '' !== ( $snap['account'] ?? '' );
	}
}
