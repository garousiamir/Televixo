<?php
/**
 * Classified Bot API response.
 *
 * outcome:
 *   ok         – ok:true
 *   retryable  – the request did not take effect (connect failure, 429, 5xx
 *                before processing); safe to retry
 *   uncertain  – the request may have taken effect (timeout after sending,
 *                504, unparsable 200 body); retrying could duplicate
 *   permanent  – Telegram rejected the request (4xx); retrying will not help
 *   auth       – 401/404 on the bot endpoint: token revoked or wrong
 *
 * @package Televixo
 */

namespace Televixo\Telegram;

defined( 'ABSPATH' ) || exit;

final class ApiResponse {

	/**
	 * @param mixed $result
	 */
	public function __construct(
		public string $outcome,
		public $result = null,
		public int $http_status = 0,
		public int $error_code = 0,
		public string $description = '',
		public ?int $retry_after = null,
		public string $migrate_to_chat_id = '',
		public string $code = ''
	) {}

	public function ok(): bool {
		return 'ok' === $this->outcome;
	}

	/**
	 * Short, stable code for logs and the queue screen.
	 */
	public function error_code_slug(): string {
		if ( '' !== $this->code ) {
			return $this->code;
		}
		$d = strtolower( $this->description );
		return match ( true ) {
			str_contains( $d, 'message thread not found' ), str_contains( $d, 'topic_deleted' ), str_contains( $d, 'thread not found' ) => 'topic_missing',
			str_contains( $d, 'topic_closed' ) => 'topic_closed',
			str_contains( $d, 'not enough rights' ), str_contains( $d, 'have no rights' ), str_contains( $d, 'chat_admin_required' ) => 'missing_permission',
			str_contains( $d, 'chat not found' ) => 'chat_not_found',
			str_contains( $d, 'bot was kicked' ), str_contains( $d, 'bot is not a member' ), str_contains( $d, 'bot was blocked' ) => 'bot_removed',
			str_contains( $d, 'message is too long' ) => 'message_too_long',
			str_contains( $d, 'message to be replied not found' ) => 'reply_target_missing',
			str_contains( $d, 'file is too big' ), str_contains( $d, 'request entity too large' ) => 'file_too_large',
			'' !== $this->migrate_to_chat_id => 'chat_migrated',
			429 === $this->error_code => 'rate_limited',
			default => 'telegram_' . ( $this->error_code ?: $this->http_status ?: 'error' ),
		};
	}
}
