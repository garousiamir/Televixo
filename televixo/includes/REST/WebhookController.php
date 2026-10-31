<?php
/**
 * Telegram webhook.
 *
 * The update is authenticated by the X-Telegram-Bot-Api-Secret-Token header
 * (constant-time comparison), bounded in size, and durably stored before a
 * 200 is returned. A storage failure returns 500 so Telegram redelivers.
 * Duplicates are acknowledged without reprocessing. Processing happens after
 * the response (bounded) or in the background worker.
 *
 * @package Televixo
 */

namespace Televixo\REST;

use Televixo\Security\Secrets;
use Televixo\Telegram\BotApi;
use Televixo\Telegram\Health;
use Televixo\Telegram\Inbound;

defined( 'ABSPATH' ) || exit;

final class WebhookController extends Controller {

	public const MAX_BYTES = 1048576;

	public function register(): void {
		$this->route( '/telegram/webhook', 'POST', array( $this, 'receive' ), array( $this, 'authenticate' ) );
	}

	/**
	 * @return true|\WP_Error
	 */
	public function authenticate( \WP_REST_Request $r ) {
		$expected = Secrets::get( 'webhook_secret' );
		$given    = (string) $r->get_header( 'X-Telegram-Bot-Api-Secret-Token' );
		if ( '' === $expected || '' === $given || ! hash_equals( $expected, $given ) ) {
			return self::error( 'forbidden', 'Forbidden', 403 );
		}
		return true;
	}

	public function receive( \WP_REST_Request $r ) {
		$raw = (string) $r->get_body();
		if ( strlen( $raw ) > self::MAX_BYTES ) {
			return self::error( 'payload_too_large', 'Payload too large', 413 );
		}
		$update = json_decode( $raw, true, 64, JSON_BIGINT_AS_STRING );
		if ( ! is_array( $update ) || ! isset( $update['update_id'] ) || ! preg_match( '/^\d{1,20}$/', (string) $update['update_id'] ) ) {
			// Acknowledge malformed payloads so Telegram does not retry forever.
			return array(
				'ok'      => true,
				'ignored' => 'malformed',
			);
		}
		$account = ( new BotApi() )->bot_id();
		if ( '' === $account ) {
			return self::error( 'not_configured', 'Not configured', 503 );
		}
		try {
			$new = Inbound::store( $account, $update );
		} catch ( \Throwable $e ) {
			return self::error( 'storage_failed', 'Temporary failure', 500 );
		}
		Health::mark_webhook_seen();
		if ( $new ) {
			do_action( 'televixo_inbound_stored' );
		}
		return array( 'ok' => true );
	}
}
