<?php
/**
 * Rule-based welcome flow with explicit human handoff. Messages are stored
 * as `automation` authored so the widget labels them as automated and
 * reports exclude them from human response metrics.
 *
 * @package Televixo
 */

namespace Televixo\Automation;

use Televixo\Core\Settings;
use Televixo\Domain\Conversations;
use Televixo\Domain\DomainException;
use Televixo\Domain\Messages;
use Televixo\Persistence\Db;
use Televixo\REST\Serializer;

defined( 'ABSPATH' ) || exit;

final class Welcome {

	/**
	 * Posts the welcome message once for a new conversation.
	 *
	 * @return array<string,mixed>|null
	 */
	public static function maybe_start( array $conversation ): ?array {
		$a = (array) Settings::get( 'automation' );
		if ( empty( $a['welcome_enabled'] ) || '' === trim( (string) $a['welcome_message'] ) ) {
			return null;
		}
		$has = (int) Db::var( Db::prepare( 'SELECT COUNT(*) FROM {messages} WHERE conversation_id = %d', (int) $conversation['id'] ) );
		if ( $has > 0 ) {
			return self::options_payload( $a );
		}
		Messages::create_automation_message( $conversation, (string) $a['welcome_message'], __( 'Automated assistant', 'televixo' ) );
		return self::options_payload( $a );
	}

	/**
	 * @return array<string,mixed>
	 */
	private static function options_payload( array $a ): array {
		$opts = array();
		foreach ( (array) $a['welcome_options'] as $i => $opt ) {
			$opts[] = array( 'index' => $i, 'label' => $opt['label'], 'handoff' => (bool) $opt['handoff'] );
		}
		return array( 'options' => $opts );
	}

	/**
	 * A visitor picked a welcome option. A handoff option (or any option
	 * without an automated answer) stops automation and queues for a human.
	 *
	 * @return array<string,mixed>
	 * @throws DomainException On invalid option.
	 */
	public static function choose( array $conversation, int $index ): array {
		$opts = (array) Settings::get( 'automation.welcome_options', array() );
		if ( ! isset( $opts[ $index ] ) ) {
			throw new DomainException( 'invalid_option', __( 'Invalid option.', 'televixo' ), 422 );
		}
		$opt    = $opts[ $index ];
		$result = Messages::create_visitor_message( $conversation, (int) $conversation['visitor_id'], $opt['label'], 'welcome-' . $conversation['public_id'] . '-' . $index );
		$reply  = null;
		if ( ! $opt['handoff'] && '' !== trim( (string) $opt['reply'] ) ) {
			$reply = Messages::create_automation_message( $conversation, (string) $opt['reply'], __( 'Automated assistant', 'televixo' ) );
		}
		$fresh = Conversations::get( (int) $conversation['id'] ) ?? $conversation;
		return array(
			'messages'     => Serializer::visitor_messages( array_values( array_filter( array( $result['message'], $reply ) ) ), $fresh ),
			'handoff'      => (bool) $opt['handoff'],
			'conversation' => Serializer::visitor_conversation( $fresh ),
		);
	}

	public static function on_visitor_message( array $conversation ): void {
		// Free-text messages always reach humans; nothing to automate here.
	}
}
