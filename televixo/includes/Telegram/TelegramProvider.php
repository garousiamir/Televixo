<?php
/**
 * Telegram implementation of the provider contract: outbound delivery jobs
 * and inbound update processing.
 *
 * @package Televixo
 */

namespace Televixo\Telegram;

use Televixo\Core\Settings;
use Televixo\Domain\Attachments;
use Televixo\Domain\Conversations;
use Televixo\Domain\DeliveryState;
use Televixo\Domain\Events;
use Televixo\Domain\Messages;
use Televixo\Persistence\Db;
use Televixo\Provider\DeliveryResult;
use Televixo\Provider\ProviderInterface;
use Televixo\Queue\Outbox;

defined( 'ABSPATH' ) || exit;

class TelegramProvider implements ProviderInterface {

	private ?BotApi $api = null;

	public function key(): string {
		return 'telegram';
	}

	public function api(): BotApi {
		if ( null === $this->api ) {
			$this->api = new BotApi();
		}
		return $this->api;
	}

	public function set_api( BotApi $api ): void {
		$this->api = $api;
	}

	public function is_ready(): bool {
		return $this->api()->has_token() && '' !== (string) Settings::get( 'telegram.destination_chat_id' );
	}

	public function handles( string $job_type ): bool {
		return str_starts_with( $job_type, 'telegram.' );
	}

	public function process( array $job ): DeliveryResult {
		return match ( (string) $job['job_type'] ) {
			'telegram.deliver'     => $this->deliver( $job, false ),
			'telegram.mirror'      => $this->deliver( $job, true ),
			'telegram.notice'      => $this->notice( $job ),
			'telegram.topic_state' => $this->topic_state( $job ),
			default                => DeliveryResult::failed( 'unknown_job', 'Unknown job type.' ),
		};
	}

	public function process_inbound( array $payload, int $attempt ): string {
		return ( new UpdateProcessor( $this->api() ) )->process( $payload, $attempt );
	}

	/**
	 * Delivers a visitor message (or mirrors an inbox reply) part by part.
	 * Each accepted part is mapped and recorded in job progress before the
	 * next part is sent, so a retry after a crash or partial failure resumes
	 * at the first unsent part instead of resending everything.
	 */
	private function deliver( array $job, bool $mirror ): DeliveryResult {
		$payload = Outbox::payload( $job );
		$message = Messages::get( (int) ( $payload['message_id'] ?? 0 ) );
		if ( ! $message ) {
			return DeliveryResult::done();
		}
		$conversation = Conversations::get( (int) $message['conversation_id'] );
		if ( ! $conversation || 'spam' === $conversation['status'] ) {
			Messages::set_delivery( (int) $message['id'], DeliveryState::NotApplicable );
			return DeliveryResult::done();
		}
		$snap    = Conversations::snapshot( $conversation );
		$account = (string) ( $snap['account'] ?? '' );
		$chat_id = (string) ( $snap['chat_id'] ?? '' );
		if ( '' === $chat_id || '' === $account ) {
			return DeliveryResult::failed( 'not_configured', 'No destination in routing snapshot.' );
		}
		if ( $account !== $this->api()->bot_id() ) {
			// The bot was replaced; old conversations cannot be delivered with a
			// different bot without an explicit, audited migration.
			Messages::set_delivery( (int) $message['id'], DeliveryState::Failed, 'bot_changed' );
			return DeliveryResult::failed( 'bot_changed', 'Routing snapshot belongs to a different bot.' );
		}

		$topics           = 'topics' === ( $snap['mode'] ?? 'reply' );
		$progress         = Outbox::progress( $job );
		$progress['done'] = (array) ( $progress['done'] ?? array() );

		$thread_id = '';
		if ( $topics ) {
			$res = $this->ensure_topic( $conversation, $account, $chat_id );
			if ( $res instanceof DeliveryResult ) {
				return $res;
			}
			$thread_id    = $res;
			$conversation = Conversations::get( (int) $conversation['id'] ) ?? $conversation;
		}

		$visitor            = Db::row( Db::prepare( 'SELECT * FROM {visitors} WHERE id = %d', (int) $conversation['visitor_id'] ) ) ?? array();
		$parts              = $this->build_parts( $conversation, $visitor, $message, $snap, $mirror, $topics );
		$first_reply_target = $mirror || ! $topics ? $this->reply_target( $conversation, $chat_id, $mirror ) : '';

		foreach ( $parts as $key => $part ) {
			if ( in_array( $key, $progress['done'], true ) ) {
				continue;
			}
			$params            = $part['params'];
			$params['chat_id'] = $chat_id;
			if ( '' !== $thread_id ) {
				$params['message_thread_id'] = (int) $thread_id;
			}
			if ( '' !== $first_reply_target && $mirror ) {
				$params['reply_parameters'] = array(
					'message_id'                  => (int) $first_reply_target,
					'allow_sending_without_reply' => true,
				);
			}
			$res = $this->api()->call( $part['method'], $params, $part['files'] ?? array() );
			if ( ! $res->ok() ) {
				return $this->handle_failure( $job, $res, $conversation, $message, $progress, $topics, $thread_id );
			}
			$sent_id = (string) ( $res->result['message_id'] ?? '' );
			if ( '' !== $sent_id ) {
				Mappings::add_message( $account, $chat_id, $sent_id, $thread_id, (int) $conversation['id'], (int) $message['id'], $part['attachment_id'] ?? null, (int) $part['index'], 'out' );
			}
			$progress['done'][] = $key;
			Outbox::save_progress( $job, $progress );
			if ( count( $progress['done'] ) < count( $parts ) ) {
				Messages::set_delivery( (int) $message['id'], DeliveryState::PartiallySent );
			}
		}
		Messages::set_delivery( (int) $message['id'], DeliveryState::ProviderAccepted );
		return DeliveryResult::done();
	}

	/**
	 * @return array<string,array<string,mixed>>
	 */
	private function build_parts( array $conversation, array $visitor, array $message, array $snap, bool $mirror, bool $topics ): array {
		$fields = (array) ( $snap['context_fields'] ?? array( 'name' ) );
		$first  = ! $mirror && 0 === (int) Db::var( Db::prepare( "SELECT COUNT(*) FROM {provider_messages} WHERE conversation_id = %d AND direction = 'out'", (int) $conversation['id'] ) );
		$chunks = Formatter::chunk( (string) $message['body'] );
		$total  = count( $chunks );
		$parts  = array();
		$index  = 0;
		foreach ( $chunks as $i => $chunk ) {
			if ( $mirror ) {
				$prefix = '↩️ ' . Formatter::clean( (string) $message['author_name'] ) . ' · ' . __( 'via website inbox', 'televixo' ) . ( $topics ? '' : ' · ' . $conversation['reference'] );
			} elseif ( $topics ) {
				$prefix = $first && 0 === $i ? Formatter::header( $conversation, $visitor, $fields, true ) : '👤 ' . ( '' !== (string) ( $visitor['name'] ?? '' ) && in_array( 'name', $fields, true ) ? Formatter::clean( (string) $visitor['name'] ) : __( 'Visitor', 'televixo' ) ) . ( $total > 1 ? sprintf( ' (%d/%d)', $i + 1, $total ) : '' );
			} else {
				$prefix = Formatter::header( $conversation, $visitor, $fields, $first && 0 === $i, $i + 1, $total );
			}
			$params = array(
				'text'                 => $prefix . "\n\n" . $chunk,
				'link_preview_options' => array( 'is_disabled' => true ),
			);
			if ( ! $mirror && 0 === $i && ( $first || ! $conversation['assigned_operator_id'] ) && ! $topics ) {
				$params['reply_markup'] = self::conversation_keyboard( $conversation );
			}
			if ( $topics && $first && 0 === $i ) {
				$params['reply_markup'] = self::conversation_keyboard( $conversation );
			}
			$parts[ 'text:' . $i ] = array(
				'method' => 'sendMessage',
				'params' => $params,
				'index'  => $index++,
			);
		}
		$atts = Attachments::for_messages( array( (int) $message['id'] ) )[ (int) $message['id'] ] ?? array();
		foreach ( $atts as $att ) {
			$caption = $mirror ? '↩️ ' . Formatter::clean( (string) $message['author_name'] ) : ( $topics ? '📎' : '📎 ' . $conversation['reference'] );
			$method  = 'sendDocument';
			$field   = 'document';
			if ( 'image' === $att['kind'] && (int) $att['size_bytes'] <= 10 * MB_IN_BYTES && in_array( $att['mime'], array( 'image/jpeg', 'image/png', 'image/webp' ), true ) ) {
				$method = 'sendPhoto';
				$field  = 'photo';
			} elseif ( 'voice' === $att['kind'] && in_array( $att['mime'], array( 'audio/ogg', 'application/ogg', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a' ), true ) ) {
				$method = 'sendVoice';
				$field  = 'voice';
			}
			$parts[ 'att:' . $att['id'] ] = array(
				'method'        => $method,
				'params'        => array( 'caption' => mb_substr( $caption, 0, 200 ) ),
				'files'         => array(
					$field => array(
						'path' => Attachments::path_of( $att ),
						'name' => (string) $att['original_name'],
						'mime' => (string) $att['mime'],
					),
				),
				'attachment_id' => (int) $att['id'],
				'index'         => $index++,
			);
		}
		return $parts;
	}

	/**
	 * @return array<string,mixed>
	 */
	public static function conversation_keyboard( array $conversation ): array {
		return array(
			'inline_keyboard' => array(
				array(
					array(
						'text'          => __( 'Claim', 'televixo' ),
						'callback_data' => 'tvx:claim:' . $conversation['public_id'],
					),
					array(
						'text'          => __( 'Close', 'televixo' ),
						'callback_data' => 'tvx:close:' . $conversation['public_id'],
					),
				),
			),
		);
	}

	private function reply_target( array $conversation, string $chat_id, bool $mirror ): string {
		if ( ! $mirror ) {
			return '';
		}
		$row = Mappings::latest_for_conversation( (int) $conversation['id'], $chat_id );
		return $row ? (string) $row['provider_message_id'] : '';
	}

	/**
	 * @return string|DeliveryResult Thread ID or a failure.
	 */
	private function ensure_topic( array $conversation, string $account, string $chat_id ) {
		$thread = (string) $conversation['provider_thread_id'];
		if ( '' !== $thread ) {
			$map = Mappings::find_thread( $account, $chat_id, $thread );
			if ( $map && 'closed' === $map['state'] ) {
				$res = $this->api()->call(
					'reopenForumTopic',
					array(
						'chat_id'           => $chat_id,
						'message_thread_id' => (int) $thread,
					)
				);
				if ( $res->ok() || 'topic_not_modified' === strtolower( $res->description ) || str_contains( strtolower( $res->description ), 'topic_not_modified' ) ) {
					Mappings::set_thread_state( $account, $chat_id, $thread, 'open' );
				}
			}
			if ( ! $map || 'deleted' !== $map['state'] ) {
				return $thread;
			}
		}
		$visitor = Db::row( Db::prepare( 'SELECT * FROM {visitors} WHERE id = %d', (int) $conversation['visitor_id'] ) ) ?? array();
		$res     = $this->api()->call(
			'createForumTopic',
			array(
				'chat_id' => $chat_id,
				'name'    => Formatter::topic_name( $conversation, $visitor ),
			)
		);
		if ( ! $res->ok() ) {
			// A duplicate empty topic after an ambiguous timeout is harmless, so
			// topic creation is retried rather than held.
			if ( in_array( $res->outcome, array( 'retryable', 'uncertain' ), true ) ) {
				return DeliveryResult::retry( $res->error_code_slug(), $res->description, $res->retry_after );
			}
			if ( '' !== $res->migrate_to_chat_id ) {
				$this->migrate_chat( $chat_id, $res->migrate_to_chat_id );
				return DeliveryResult::retry( 'chat_migrated', 'Group migrated to supergroup.', 1 );
			}
			Events::record( 'telegram.topic_create_failed', 'system', '', (int) $conversation['id'], '', '', array( 'code' => $res->error_code_slug() ) );
			Health::flag( 'topics', $res->error_code_slug() );
			return 'auth' === $res->outcome
				? DeliveryResult::retry( 'auth', $res->description, 3600 )
				: DeliveryResult::failed( $res->error_code_slug(), $res->description );
		}
		$thread_id = (string) ( $res->result['message_thread_id'] ?? '' );
		if ( '' === $thread_id ) {
			return DeliveryResult::uncertain( 'malformed_response', 'Topic created without thread ID.' );
		}
		Mappings::add_thread( $account, $chat_id, $thread_id, (int) $conversation['id'] );
		Db::update( 'conversations', array( 'provider_thread_id' => $thread_id ), array( 'id' => (int) $conversation['id'] ) );
		Events::record( 'telegram.topic_created', 'system', '', (int) $conversation['id'], 'thread', $thread_id );
		return $thread_id;
	}

	private function handle_failure( array $job, ApiResponse $res, array $conversation, array $message, array $progress, bool $topics, string $thread_id ): DeliveryResult {
		$code    = $res->error_code_slug();
		$mid     = (int) $message['id'];
		$partial = ! empty( $progress['done'] );

		if ( '' !== $res->migrate_to_chat_id ) {
			$this->migrate_chat( (string) $conversation['provider_chat_id'], $res->migrate_to_chat_id );
			return DeliveryResult::retry( 'chat_migrated', 'Group migrated to supergroup.', 1 );
		}
		if ( $topics && 'topic_missing' === $code && '' !== $thread_id ) {
			$snap = Conversations::snapshot( $conversation );
			Mappings::set_thread_state( (string) $snap['account'], (string) $snap['chat_id'], $thread_id, 'deleted' );
			Events::record( 'telegram.topic_missing', 'system', '', (int) $conversation['id'], 'thread', $thread_id );
			if ( Settings::get( 'telegram.recreate_deleted_topics', true ) ) {
				Db::update( 'conversations', array( 'provider_thread_id' => '' ), array( 'id' => (int) $conversation['id'] ) );
				Outbox::save_progress( $job, array( 'done' => array() ) );
				return DeliveryResult::retry( 'topic_missing', 'Topic deleted; a new topic will be created.', 1 );
			}
		}
		if ( $topics && 'topic_closed' === $code && '' !== $thread_id ) {
			$snap = Conversations::snapshot( $conversation );
			Mappings::set_thread_state( (string) $snap['account'], (string) $snap['chat_id'], $thread_id, 'closed' );
			return DeliveryResult::retry( 'topic_closed', 'Topic closed; reopening.', 1 );
		}
		switch ( $res->outcome ) {
			case 'retryable':
				Messages::set_delivery( $mid, $partial ? DeliveryState::PartiallySent : DeliveryState::Queued, $code );
				return DeliveryResult::retry( $code, $res->description, $res->retry_after );
			case 'uncertain':
				if ( 'retry' === Settings::get( 'telegram.uncertain_policy', 'hold' ) ) {
					Messages::set_delivery( $mid, DeliveryState::Queued, $code );
					return DeliveryResult::retry( $code, $res->description );
				}
				Messages::set_delivery( $mid, DeliveryState::Uncertain, $code );
				return DeliveryResult::uncertain( $code, $res->description );
			case 'auth':
				Health::flag( 'token', $code );
				Messages::set_delivery( $mid, DeliveryState::Queued, 'auth' );
				return DeliveryResult::retry( 'auth', $res->description, 1800 );
			default:
				if ( in_array( $code, array( 'missing_permission', 'chat_not_found', 'bot_removed' ), true ) ) {
					Health::flag( 'destination', $code );
				}
				Messages::set_delivery( $mid, DeliveryState::Failed, $code );
				return DeliveryResult::failed( $code, $res->description );
		}
	}

	/**
	 * Group → supergroup migration. Telegram assigns a new chat ID; existing
	 * conversations on the old chat are migrated with an audit event. Old
	 * message mappings keep their original chat ID and remain valid for
	 * historical lookups.
	 */
	public function migrate_chat( string $old, string $new ): void {
		$new = Settings::provider_id( $new );
		if ( '' === $new || $old === $new ) {
			return;
		}
		if ( Settings::get( 'telegram.destination_chat_id' ) === $old ) {
			Settings::set_internal( 'telegram.destination_chat_id', $new );
			Settings::set_internal( 'telegram.destination_type', 'supergroup' );
		}
		$allowed = (array) Settings::get( 'telegram.allowed_chat_ids', array() );
		if ( in_array( $old, $allowed, true ) && ! in_array( $new, $allowed, true ) ) {
			$allowed[] = $new;
			Settings::set_internal( 'telegram.allowed_chat_ids', $allowed );
		}
		Db::exec( Db::prepare( 'UPDATE {teams} SET destination_chat_id = %s WHERE destination_chat_id = %s', $new, $old ) );
		$ids = Db::wpdb()->get_col( Db::prepare( 'SELECT id FROM {conversations} WHERE provider_chat_id = %s', $old ) );
		foreach ( $ids as $id ) {
			Conversations::migrate_routing( (int) $id, $new, 'telegram_supergroup_migration' );
		}
		Events::record(
			'telegram.chat_migrated',
			'system',
			'',
			null,
			'chat',
			$new,
			array(
				'from'          => $old,
				'conversations' => count( $ids ),
			)
		);
	}

	private function notice( array $job ): DeliveryResult {
		$p      = Outbox::payload( $job );
		$params = array(
			'chat_id'              => (string) $p['chat_id'],
			'text'                 => mb_substr( (string) $p['text'], 0, 1000 ),
			'link_preview_options' => array( 'is_disabled' => true ),
		);
		if ( ! empty( $p['thread_id'] ) ) {
			$params['message_thread_id'] = (int) $p['thread_id'];
		}
		if ( ! empty( $p['reply_to'] ) ) {
			$params['reply_parameters'] = array(
				'message_id'                  => (int) $p['reply_to'],
				'allow_sending_without_reply' => true,
			);
		}
		$res = $this->api()->call( 'sendMessage', $params );
		if ( $res->ok() ) {
			return DeliveryResult::done();
		}
		// Notices are best-effort; never hold them as uncertain.
		return in_array( $res->outcome, array( 'retryable' ), true )
			? DeliveryResult::retry( $res->error_code_slug(), $res->description, $res->retry_after )
			: DeliveryResult::failed( $res->error_code_slug(), $res->description );
	}

	private function topic_state( array $job ): DeliveryResult {
		$conversation = Conversations::get( (int) $job['conversation_id'] );
		if ( ! $conversation || '' === (string) $conversation['provider_thread_id'] ) {
			return DeliveryResult::done();
		}
		$snap   = Conversations::snapshot( $conversation );
		$state  = (string) ( Outbox::payload( $job )['state'] ?? 'closed' );
		$method = 'closed' === $state ? 'closeForumTopic' : 'reopenForumTopic';
		$res    = $this->api()->call(
			$method,
			array(
				'chat_id'           => (string) $snap['chat_id'],
				'message_thread_id' => (int) $conversation['provider_thread_id'],
			)
		);
		if ( $res->ok() || str_contains( strtolower( $res->description ), 'topic_not_modified' ) ) {
			Mappings::set_thread_state( (string) $snap['account'], (string) $snap['chat_id'], (string) $conversation['provider_thread_id'], 'closed' === $state ? 'closed' : 'open' );
			return DeliveryResult::done();
		}
		return 'retryable' === $res->outcome ? DeliveryResult::retry( $res->error_code_slug(), $res->description, $res->retry_after ) : DeliveryResult::failed( $res->error_code_slug(), $res->description );
	}

	/**
	 * Queues a best-effort feedback message to an operator.
	 */
	public static function queue_notice( string $chat_id, string $text, string $reply_to = '', string $thread_id = '' ): void {
		Outbox::enqueue(
			'telegram.notice',
			'',
			array(
				'chat_id'   => $chat_id,
				'text'      => $text,
				'reply_to'  => $reply_to,
				'thread_id' => $thread_id,
			),
			null,
			null,
			0,
			3
		);
	}
}
