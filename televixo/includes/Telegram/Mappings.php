<?php
/**
 * Provider message and thread mappings, scoped by (provider, bot account,
 * chat ID, message/thread ID). Mappings are never rewritten when routing
 * defaults change, so replies to old messages keep resolving.
 *
 * @package Televixo
 */

namespace Televixo\Telegram;

use Televixo\Core\Clock;
use Televixo\Persistence\Db;

defined( 'ABSPATH' ) || exit;

final class Mappings {

	public static function add_message( string $account, string $chat_id, string $provider_message_id, string $thread_id, int $conversation_id, ?int $message_id, ?int $attachment_id, int $part, string $direction ): void {
		Db::insert_ignore_duplicate(
			'provider_messages',
			array(
				'provider'            => 'telegram',
				'account_id'          => $account,
				'chat_id'             => $chat_id,
				'provider_message_id' => $provider_message_id,
				'thread_id'           => $thread_id,
				'conversation_id'     => $conversation_id,
				'message_id'          => $message_id,
				'attachment_id'       => $attachment_id,
				'part_index'          => $part,
				'direction'           => $direction,
				'created_at'          => Clock::mysql(),
			)
		);
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function find_message( string $account, string $chat_id, string $provider_message_id ): ?array {
		return Db::row(
			Db::prepare(
				"SELECT * FROM {provider_messages} WHERE provider = 'telegram' AND account_id = %s AND chat_id = %s AND provider_message_id = %s",
				$account,
				$chat_id,
				$provider_message_id
			)
		);
	}

	/**
	 * Latest outbound mapping for a conversation (used as reply target).
	 *
	 * @return array<string,mixed>|null
	 */
	public static function latest_for_conversation( int $conversation_id, string $chat_id ): ?array {
		return Db::row(
			Db::prepare(
				"SELECT * FROM {provider_messages} WHERE conversation_id = %d AND chat_id = %s AND direction = 'out' ORDER BY id DESC LIMIT 1",
				$conversation_id,
				$chat_id
			)
		);
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function find_thread( string $account, string $chat_id, string $thread_id ): ?array {
		return Db::row(
			Db::prepare(
				"SELECT * FROM {provider_threads} WHERE provider = 'telegram' AND account_id = %s AND chat_id = %s AND thread_id = %s",
				$account,
				$chat_id,
				$thread_id
			)
		);
	}

	public static function add_thread( string $account, string $chat_id, string $thread_id, int $conversation_id ): void {
		$now = Clock::mysql();
		Db::insert_ignore_duplicate(
			'provider_threads',
			array(
				'provider'        => 'telegram',
				'account_id'      => $account,
				'chat_id'         => $chat_id,
				'thread_id'       => $thread_id,
				'conversation_id' => $conversation_id,
				'state'           => 'open',
				'created_at'      => $now,
				'updated_at'      => $now,
			)
		);
	}

	public static function set_thread_state( string $account, string $chat_id, string $thread_id, string $state ): void {
		Db::exec(
			Db::prepare(
				"UPDATE {provider_threads} SET state = %s, updated_at = %s WHERE provider = 'telegram' AND account_id = %s AND chat_id = %s AND thread_id = %s",
				$state,
				Clock::mysql(),
				$account,
				$chat_id,
				$thread_id
			)
		);
	}
}
