<?php
/**
 * Normalized inbound operator message.
 *
 * @package Televixo
 */

namespace Televixo\Provider;

defined( 'ABSPATH' ) || exit;

final class InboundMessage {

	/**
	 * @param array<int,array{file_id:string,file_size:int,name:string,mime:string,kind:string}> $files
	 */
	public function __construct(
		public string $provider,
		public string $account_id,
		public string $chat_id,
		public string $chat_type,
		public string $thread_id,
		public bool $is_topic_message,
		public string $message_id,
		public string $sender_id,
		public string $sender_name,
		public string $sender_username,
		public bool $sender_is_bot,
		public bool $anonymous,
		public string $text,
		public string $reply_to_message_id,
		public array $files = array()
	) {}
}
