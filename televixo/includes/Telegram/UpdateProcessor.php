<?php
/**
 * Turns a Telegram update into domain actions.
 *
 * Authorization is applied to every update independently of webhook
 * authentication:
 *   1. bot echoes and unsupported service messages are ignored;
 *   2. the chat must be an allowlisted destination (or a private chat for
 *      enrollment/availability commands);
 *   3. anonymous admins / channel senders are rejected because no individual
 *      can be authorized;
 *   4. the sender must be an enrolled, active operator whose WordPress
 *      account still holds an inbox capability;
 *   5. the target conversation is resolved only from exact stored mappings
 *      (replied-to message ID or topic thread ID) inside that chat, and the
 *      conversation's routing snapshot must name the same chat;
 *   6. conversation-level access is checked (assignment / team / view all).
 * There is no "last active visitor" fallback anywhere.
 *
 * @package Televixo
 */

namespace Televixo\Telegram;

use Televixo\Core\Clock;
use Televixo\Core\Settings;
use Televixo\Domain\Assignment;
use Televixo\Domain\Attachments;
use Televixo\Domain\Conversations;
use Televixo\Domain\DomainException;
use Televixo\Domain\Events;
use Televixo\Domain\Messages;
use Televixo\Domain\Operators;
use Televixo\Persistence\Db;
use Televixo\Provider\InboundMessage;

defined( 'ABSPATH' ) || exit;

final class UpdateProcessor {

	private BotApi $api;
	private string $account;

	public function __construct( BotApi $api ) {
		$this->api     = $api;
		$this->account = $api->bot_id();
	}

	/**
	 * @param array<string,mixed> $u
	 * @return string Result code; 'defer' asks the caller to retry later.
	 */
	public function process( array $u, int $attempt = 1 ): string {
		if ( isset( $u['callback_query'] ) && is_array( $u['callback_query'] ) ) {
			return $this->callback( $u['callback_query'] );
		}
		if ( isset( $u['message'] ) && is_array( $u['message'] ) ) {
			return $this->message( $u['message'], $attempt );
		}
		if ( isset( $u['my_chat_member'] ) && is_array( $u['my_chat_member'] ) ) {
			return $this->membership( $u['my_chat_member'] );
		}
		// edited_message, channel_post, reactions, etc. are not relayed.
		return 'ignored:unsupported_update';
	}

	/**
	 * Chats from which operator messages are accepted.
	 *
	 * @return string[]
	 */
	public static function allowed_chats(): array {
		$chats = array_merge(
			array( (string) Settings::get( 'telegram.destination_chat_id', '' ) ),
			(array) Settings::get( 'telegram.allowed_chat_ids', array() ),
			Db::wpdb()->get_col( Db::prepare( "SELECT destination_chat_id FROM {teams} WHERE destination_chat_id <> ''" ) )
		);
		return array_values( array_unique( array_filter( array_map( 'strval', $chats ) ) ) );
	}

	public static function normalize( array $m, string $account ): InboundMessage {
		$from  = is_array( $m['from'] ?? null ) ? $m['from'] : array();
		$chat  = is_array( $m['chat'] ?? null ) ? $m['chat'] : array();
		$files = array();
		if ( ! empty( $m['photo'] ) && is_array( $m['photo'] ) ) {
			$largest = end( $m['photo'] );
			$files[] = array( 'file_id' => (string) $largest['file_id'], 'file_size' => (int) ( $largest['file_size'] ?? 0 ), 'name' => 'photo.jpg', 'mime' => 'image/jpeg', 'kind' => 'image' );
		}
		foreach ( array( 'document' => 'file', 'voice' => 'voice', 'audio' => 'voice' ) as $key => $kind ) {
			if ( ! empty( $m[ $key ]['file_id'] ) ) {
				$default = 'voice' === $key ? 'voice.ogg' : ( 'audio' === $key ? 'audio.mp3' : 'file' );
				$files[] = array(
					'file_id'   => (string) $m[ $key ]['file_id'],
					'file_size' => (int) ( $m[ $key ]['file_size'] ?? 0 ),
					'name'      => (string) ( $m[ $key ]['file_name'] ?? $default ),
					'mime'      => (string) ( $m[ $key ]['mime_type'] ?? '' ),
					'kind'      => $kind,
				);
			}
		}
		$name     = trim( ( $from['first_name'] ?? '' ) . ' ' . ( $from['last_name'] ?? '' ) );
		$thread   = isset( $m['message_thread_id'] ) ? (string) $m['message_thread_id'] : '';
		$reply_to = isset( $m['reply_to_message']['message_id'] ) ? (string) $m['reply_to_message']['message_id'] : '';
		// Inside a forum topic every message implicitly replies to the topic's
		// root service message (whose ID equals the thread ID); that is not an
		// explicit reply.
		if ( ! empty( $m['is_topic_message'] ) && $reply_to === $thread ) {
			$reply_to = '';
		}
		return new InboundMessage(
			'telegram',
			$account,
			(string) ( $chat['id'] ?? '' ),
			(string) ( $chat['type'] ?? '' ),
			$thread,
			! empty( $m['is_topic_message'] ),
			(string) ( $m['message_id'] ?? '' ),
			(string) ( $from['id'] ?? '' ),
			$name,
			(string) ( $from['username'] ?? '' ),
			! empty( $from['is_bot'] ),
			isset( $m['sender_chat'] ) || ( isset( $from['username'] ) && 'GroupAnonymousBot' === $from['username'] ),
			(string) ( $m['text'] ?? $m['caption'] ?? '' ),
			$reply_to,
			$files
		);
	}

	private function message( array $m, int $attempt ): string {
		$msg = self::normalize( $m, $this->account );

		if ( isset( $m['migrate_to_chat_id'] ) ) {
			( new TelegramProvider() )->migrate_chat( $msg->chat_id, (string) $m['migrate_to_chat_id'] );
			return 'processed:chat_migrated';
		}
		if ( $msg->sender_is_bot && ! $msg->anonymous ) {
			return 'ignored:bot_sender';
		}
		foreach ( array( 'forum_topic_closed' => 'closed', 'forum_topic_reopened' => 'open' ) as $key => $state ) {
			if ( isset( $m[ $key ] ) && '' !== $msg->thread_id ) {
				Mappings::set_thread_state( $this->account, $msg->chat_id, $msg->thread_id, $state );
				return 'processed:topic_' . $state;
			}
		}
		if ( $this->is_service( $m ) ) {
			return 'ignored:service_message';
		}

		if ( 'private' === $msg->chat_type && ! in_array( $msg->chat_id, self::allowed_chats(), true ) ) {
			return $this->private_command( $msg );
		}
		if ( ! in_array( $msg->chat_id, self::allowed_chats(), true ) ) {
			return 'ignored:chat_not_allowed';
		}
		if ( $msg->anonymous ) {
			if ( '' !== $msg->reply_to_message_id || '' !== $msg->thread_id ) {
				$this->feedback( $msg, __( 'Anonymous admin messages cannot be sent to visitors because the sender cannot be identified. Turn off "Remain anonymous" to reply.', 'televixo' ) );
			}
			return 'ignored:anonymous_sender';
		}

		$text = trim( $msg->text );
		if ( preg_match( '#^/(start|link)(@\w+)?\b#', $text ) && 'private' === $msg->chat_type ) {
			return $this->private_command( $msg );
		}

		[ $conversation, $how ] = $this->resolve( $msg );
		$operator               = Operators::by_telegram( $msg->sender_id );

		if ( ! $conversation ) {
			if ( 'ambiguous' === $how ) {
				$this->feedback( $msg, __( 'That reply points to a different conversation than this topic, so it was not sent.', 'televixo' ) );
				return 'ignored:ambiguous_reply';
			}
			if ( preg_match( '#^/(online|away|offline)(@\w+)?\b#', $text ) && $operator ) {
				return $this->availability_command( $msg, $operator, $text );
			}
			if ( '' !== $msg->reply_to_message_id && 'reply' === $how ) {
				// Maybe the mapping of a just-sent message is not committed yet.
				if ( $attempt < 3 && $this->recent( $m ) ) {
					return 'defer';
				}
				if ( $operator ) {
					$this->feedback( $msg, __( 'This reply is not linked to a website conversation, so it was not sent. Reply directly to a visitor message from the bot.', 'televixo' ) );
				}
				return 'ignored:unmapped_reply';
			}
			return 'ignored:no_conversation';
		}

		if ( ! $operator ) {
			$this->feedback( $msg, __( 'You are not an enrolled Televixo operator, so your message was not sent to the visitor. Ask an administrator for an enrollment code.', 'televixo' ) );
			Events::record( 'telegram.unauthorized_sender', 'telegram', $msg->sender_id, (int) $conversation['id'] );
			return 'ignored:unauthorized_sender';
		}

		// Topic forwarding policy: only explicit replies in "replies_only".
		$snap = Conversations::snapshot( $conversation );
		if ( 'thread' === $how && 'replies_only' === ( $snap['forwarding'] ?? '' ) && ! $this->is_reply_to_mapped( $msg ) && ! str_starts_with( $text, '/' ) ) {
			return 'ignored:topic_chatter';
		}

		if ( preg_match( '#^/(\w+)(@\w+)?\s*(.*)$#s', $text, $cmd ) ) {
			return $this->conversation_command( $msg, $operator, $conversation, strtolower( $cmd[1] ), trim( $cmd[3] ) );
		}

		if ( ! Operators::can_access( $operator, $conversation ) ) {
			$this->feedback( $msg, __( 'This conversation is assigned to another operator. Your message was not sent.', 'televixo' ) );
			return 'ignored:not_assigned';
		}

		$note_prefix = (string) ( $snap['note_prefix'] ?? '#note' );
		if ( '' !== $note_prefix && str_starts_with( $text, $note_prefix ) ) {
			Messages::create_note( $conversation, $operator, trim( substr( $text, strlen( $note_prefix ) ) ), 'telegram' );
			return 'processed:note';
		}
		if ( 'spam' === $conversation['status'] ) {
			$this->feedback( $msg, __( 'This conversation is marked as spam; replies are not delivered.', 'televixo' ) );
			return 'ignored:spam';
		}

		if ( ! $conversation['assigned_operator_id'] && Settings::get( 'telegram.auto_claim_on_reply', true ) && 'closed' !== $conversation['status'] ) {
			try {
				$conversation = Assignment::claim( $conversation, $operator, 'reply' );
			} catch ( DomainException $e ) {
				$this->feedback( $msg, __( 'Another operator claimed this conversation a moment ago. Your message was not sent.', 'televixo' ) );
				return 'ignored:claim_conflict';
			}
		}

		$attachment_ids = array();
		$failed_files   = 0;
		foreach ( $msg->files as $file ) {
			$att = $this->fetch_file( $conversation, $operator, $file );
			if ( $att ) {
				$attachment_ids[] = (int) $att['id'];
			} else {
				++$failed_files;
			}
		}
		if ( '' === $text && ! $attachment_ids ) {
			if ( $failed_files ) {
				$this->feedback( $msg, __( 'The file could not be delivered (type or size not allowed).', 'televixo' ) );
			}
			return 'ignored:empty';
		}
		$local = Messages::create_operator_message( $conversation, $operator, $text, 'telegram', $attachment_ids );
		// Map the operator's own Telegram message so replies to it resolve too.
		Mappings::add_message( $this->account, $msg->chat_id, $msg->message_id, $msg->thread_id, (int) $conversation['id'], (int) $local['id'], null, 0, 'in' );
		if ( $failed_files ) {
			$this->feedback( $msg, __( 'Your text was delivered, but an attachment was refused (type or size not allowed).', 'televixo' ) );
		}
		return 'processed:reply';
	}

	/**
	 * @return array{0:array<string,mixed>|null,1:string}
	 */
	private function resolve( InboundMessage $msg ): array {
		if ( '' !== $msg->thread_id && $msg->is_topic_message ) {
			$thread = Mappings::find_thread( $this->account, $msg->chat_id, $msg->thread_id );
			if ( $thread ) {
				$conv = Conversations::get( (int) $thread['conversation_id'] );
				if ( $conv && $this->same_chat( $conv, $msg->chat_id ) ) {
					return array( $conv, 'thread' );
				}
			}
		}
		if ( '' !== $msg->reply_to_message_id ) {
			$map = Mappings::find_message( $this->account, $msg->chat_id, $msg->reply_to_message_id );
			if ( $map ) {
				$conv = Conversations::get( (int) $map['conversation_id'] );
				if ( $conv && $this->same_chat( $conv, $msg->chat_id ) ) {
					// A reply inside topic B to a message from conversation A is
					// ambiguous: reject rather than guess.
					if ( '' !== $msg->thread_id && $msg->is_topic_message && '' !== (string) $conv['provider_thread_id'] && (string) $conv['provider_thread_id'] !== $msg->thread_id ) {
						return array( null, 'ambiguous' );
					}
					return array( $conv, 'reply' );
				}
			}
			return array( null, 'reply' );
		}
		return array( null, 'none' );
	}

	private function same_chat( array $conversation, string $chat_id ): bool {
		$snap = Conversations::snapshot( $conversation );
		return (string) ( $snap['chat_id'] ?? '' ) === $chat_id
			|| (string) ( $snap['migrated_from'] ?? '' ) === $chat_id
			|| (string) $conversation['provider_chat_id'] === $chat_id;
	}

	private function is_reply_to_mapped( InboundMessage $msg ): bool {
		return '' !== $msg->reply_to_message_id && null !== Mappings::find_message( $this->account, $msg->chat_id, $msg->reply_to_message_id );
	}

	private function recent( array $m ): bool {
		return isset( $m['date'] ) && Clock::now() - (int) $m['date'] < 120;
	}

	private function is_service( array $m ): bool {
		foreach ( array( 'new_chat_members', 'left_chat_member', 'new_chat_title', 'new_chat_photo', 'delete_chat_photo', 'group_chat_created', 'supergroup_chat_created', 'pinned_message', 'forum_topic_created', 'forum_topic_edited', 'general_forum_topic_hidden', 'general_forum_topic_unhidden', 'migrate_from_chat_id', 'video_chat_started', 'video_chat_ended', 'message_auto_delete_timer_changed' ) as $key ) {
			if ( isset( $m[ $key ] ) ) {
				return true;
			}
		}
		return ! empty( $m['is_automatic_forward'] );
	}

	private function private_command( InboundMessage $msg ): string {
		$text = trim( $msg->text );
		if ( preg_match( '#^/link(?:@\w+)?\s+([0-9A-Za-z]{10})\s*$#', $text, $mm ) ) {
			if ( $msg->anonymous || '' === $msg->sender_id ) {
				return 'ignored:anonymous_sender';
			}
			$op = Operators::consume_challenge( $mm[1], $msg->sender_id, $msg->sender_username );
			$this->reply_private( $msg, $op
				? sprintf( /* translators: %s: operator display name */ __( 'Linked to Televixo operator %s. You can now reply to visitor messages in the support group.', 'televixo' ), (string) $op['display_name'] )
				: __( 'That code is invalid or expired. Create a new code in WordPress → Televixo → Operators.', 'televixo' ) );
			return $op ? 'processed:enrolled' : 'ignored:bad_challenge';
		}
		if ( preg_match( '#^/start\b#', $text ) ) {
			$this->reply_private( $msg, __( 'Hello! This bot relays website chats. To become an operator, open WordPress → Televixo → Operators, create an enrollment code and send it here as: /link CODE', 'televixo' ) );
			return 'processed:start';
		}
		$op = Operators::by_telegram( $msg->sender_id );
		if ( $op && preg_match( '#^/(online|away|offline)\b#', $text ) ) {
			return $this->availability_command( $msg, $op, $text );
		}
		return 'ignored:private_message';
	}

	private function availability_command( InboundMessage $msg, array $operator, string $text ): string {
		preg_match( '#^/(online|away|offline)#', $text, $mm );
		$state = $mm[1];
		$until = 'online' === $state ? Clock::now() + 8 * HOUR_IN_SECONDS : null;
		Operators::set_availability( (int) $operator['id'], $state, $until );
		$labels = array(
			'online'  => __( 'You are marked available for the next 8 hours (or until you send /away or /offline).', 'televixo' ),
			'away'    => __( 'You are marked away.', 'televixo' ),
			'offline' => __( 'You are marked offline.', 'televixo' ),
		);
		$this->feedback( $msg, $labels[ $state ] );
		return 'processed:availability';
	}

	private function conversation_command( InboundMessage $msg, array $operator, array $conversation, string $cmd, string $arg ): string {
		try {
			switch ( $cmd ) {
				case 'claim':
					Assignment::claim( $conversation, $operator );
					$this->feedback( $msg, sprintf( /* translators: %s: conversation reference */ __( 'You claimed %s.', 'televixo' ), $conversation['reference'] ) );
					return 'processed:claim';
				case 'close':
					if ( ! Operators::can_access( $operator, $conversation ) ) {
						break;
					}
					Conversations::close( $conversation, 'operator', (string) $operator['id'] );
					$this->feedback( $msg, sprintf( /* translators: %s: conversation reference */ __( '%s closed.', 'televixo' ), $conversation['reference'] ) );
					return 'processed:close';
				case 'note':
					if ( ! Operators::can_access( $operator, $conversation ) || '' === $arg ) {
						break;
					}
					Messages::create_note( $conversation, $operator, $arg, 'telegram' );
					return 'processed:note';
				case 'spam':
					if ( ! Operators::can_access( $operator, $conversation ) ) {
						break;
					}
					Conversations::mark_spam( $conversation, 'operator', (string) $operator['id'] );
					$this->feedback( $msg, __( 'Marked as spam. Further visitor messages will not be relayed.', 'televixo' ) );
					return 'processed:spam';
				case 'online':
				case 'away':
				case 'offline':
					return $this->availability_command( $msg, $operator, '/' . $cmd );
				default:
					$this->feedback( $msg, __( 'Commands: /claim, /close, /note text, /spam, /online, /away. Messages starting with "/" are never sent to visitors.', 'televixo' ) );
					return 'ignored:unknown_command';
			}
		} catch ( DomainException $e ) {
			$this->feedback( $msg, $e->getMessage() );
			return 'ignored:' . $e->error_code;
		}
		$this->feedback( $msg, __( 'You do not have access to this conversation.', 'televixo' ) );
		return 'ignored:not_assigned';
	}

	private function callback( array $q ): string {
		$id      = (string) ( $q['id'] ?? '' );
		$from    = (string) ( $q['from']['id'] ?? '' );
		$chat_id = (string) ( $q['message']['chat']['id'] ?? '' );
		$data    = (string) ( $q['data'] ?? '' );
		$answer  = function ( string $text ) use ( $id ): void {
			if ( '' !== $id ) {
				$this->api->call( 'answerCallbackQuery', array( 'callback_query_id' => $id, 'text' => mb_substr( $text, 0, 190 ), 'show_alert' => false ) );
			}
		};
		if ( ! preg_match( '/^tvx:(claim|close):([0-9a-z]{26})$/', $data, $mm ) ) {
			$answer( __( 'Unsupported action.', 'televixo' ) );
			return 'ignored:bad_callback';
		}
		if ( ! in_array( $chat_id, self::allowed_chats(), true ) ) {
			return 'ignored:chat_not_allowed';
		}
		// The button payload only names the conversation; it authorizes nothing.
		$operator = Operators::by_telegram( $from );
		if ( ! $operator ) {
			$answer( __( 'You are not an enrolled operator.', 'televixo' ) );
			return 'ignored:unauthorized_sender';
		}
		$conversation = Conversations::by_public_id( $mm[2] );
		if ( ! $conversation || ! $this->same_chat( $conversation, $chat_id ) ) {
			$answer( __( 'Conversation not found.', 'televixo' ) );
			return 'ignored:no_conversation';
		}
		try {
			if ( 'claim' === $mm[1] ) {
				Assignment::claim( $conversation, $operator );
				$answer( sprintf( /* translators: %s: conversation reference */ __( 'You claimed %s.', 'televixo' ), $conversation['reference'] ) );
				return 'processed:callback_claim';
			}
			if ( ! Operators::can_access( $operator, $conversation ) ) {
				$answer( __( 'This conversation is assigned to another operator.', 'televixo' ) );
				return 'ignored:not_assigned';
			}
			Conversations::close( $conversation, 'operator', (string) $operator['id'] );
			$answer( __( 'Conversation closed.', 'televixo' ) );
			return 'processed:callback_close';
		} catch ( DomainException $e ) {
			$answer( $e->getMessage() );
			return 'ignored:' . $e->error_code;
		}
	}

	private function membership( array $m ): string {
		$chat   = (string) ( $m['chat']['id'] ?? '' );
		$status = (string) ( $m['new_chat_member']['status'] ?? '' );
		if ( in_array( $chat, self::allowed_chats(), true ) ) {
			if ( in_array( $status, array( 'left', 'kicked' ), true ) ) {
				Health::flag( 'destination', 'bot_removed' );
			} elseif ( in_array( $status, array( 'member', 'administrator' ), true ) ) {
				Health::clear( 'destination' );
			}
			Events::record( 'telegram.membership', 'telegram', (string) ( $m['from']['id'] ?? '' ), null, 'chat', $chat, array( 'status' => $status ) );
		}
		return 'processed:membership';
	}

	private function fetch_file( array $conversation, array $operator, array $file ): ?array {
		$max = 20 * MB_IN_BYTES; // Bot API getFile download limit.
		if ( $file['file_size'] > $max ) {
			return null;
		}
		$res = $this->api->call( 'getFile', array( 'file_id' => $file['file_id'] ) );
		if ( ! $res->ok() || empty( $res->result['file_path'] ) ) {
			return null;
		}
		$tmp = $this->api->download( (string) $res->result['file_path'], $max );
		if ( ! $tmp ) {
			return null;
		}
		$name = $file['name'];
		if ( 'file' === $name || ! str_contains( $name, '.' ) ) {
			$name .= '.' . strtolower( (string) pathinfo( (string) $res->result['file_path'], PATHINFO_EXTENSION ) );
		}
		try {
			return Attachments::store( $conversation, $tmp, $name, 'operator', (int) $operator['id'], false );
		} catch ( DomainException $e ) {
			wp_delete_file( $tmp );
			return null;
		}
	}

	private function feedback( InboundMessage $msg, string $text ): void {
		TelegramProvider::queue_notice( $msg->chat_id, $text, $msg->message_id, $msg->is_topic_message ? $msg->thread_id : '' );
	}

	private function reply_private( InboundMessage $msg, string $text ): void {
		TelegramProvider::queue_notice( $msg->chat_id, $text );
	}
}
