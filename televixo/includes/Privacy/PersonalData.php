<?php
/**
 * WordPress personal data exporter/eraser integration and suggested privacy
 * policy text. Visitors are matched by the email they provided or by their
 * WordPress account email.
 *
 * @package Televixo
 */

namespace Televixo\Privacy;

use Televixo\Core\Clock;
use Televixo\Persistence\Db;

defined( 'ABSPATH' ) || exit;

final class PersonalData {

	public static function register(): void {
		add_filter( 'wp_privacy_personal_data_exporters', array( self::class, 'exporters' ) );
		add_filter( 'wp_privacy_personal_data_erasers', array( self::class, 'erasers' ) );
		add_action( 'admin_init', array( self::class, 'policy' ) );
	}

	/**
	 * @param array<string,mixed> $e
	 * @return array<string,mixed>
	 */
	public static function exporters( array $e ): array {
		$e['televixo'] = array(
			'exporter_friendly_name' => __( 'Televixo chat conversations', 'televixo' ),
			'callback'               => array( self::class, 'export' ),
		);
		return $e;
	}

	/**
	 * @param array<string,mixed> $e
	 * @return array<string,mixed>
	 */
	public static function erasers( array $e ): array {
		$e['televixo'] = array(
			'eraser_friendly_name' => __( 'Televixo chat conversations', 'televixo' ),
			'callback'             => array( self::class, 'erase' ),
		);
		return $e;
	}

	/**
	 * @return int[]
	 */
	public static function visitor_ids( string $email ): array {
		$user = get_user_by( 'email', $email );
		return array_map(
			'intval',
			Db::wpdb()->get_col(
				Db::prepare( 'SELECT id FROM {visitors} WHERE email = %s OR (wp_user_id IS NOT NULL AND wp_user_id = %d) LIMIT 500', $email, $user ? (int) $user->ID : -1 )
			)
		);
	}

	/**
	 * @return array{data:array<int,mixed>,done:bool}
	 */
	public static function export( string $email, int $page = 1 ): array {
		$ids   = self::visitor_ids( $email );
		$data  = array();
		$convs = $ids ? Db::rows( Db::prepare( 'SELECT * FROM {conversations} WHERE visitor_id IN (' . Db::in_ints( $ids ) . ') ORDER BY id ASC LIMIT %d OFFSET %d', 10, ( $page - 1 ) * 10 ) ) : array();
		foreach ( $convs as $c ) {
			$items  = array(
				array(
					'name'  => __( 'Reference', 'televixo' ),
					'value' => $c['reference'],
				),
				array(
					'name'  => __( 'Started', 'televixo' ),
					'value' => Clock::iso( $c['created_at'] ),
				),
				array(
					'name'  => __( 'Status', 'televixo' ),
					'value' => $c['status'],
				),
				array(
					'name'  => __( 'Transcript', 'televixo' ),
					'value' => nl2br( esc_html( Transcript::build( $c ) ) ),
				),
			);
			$data[] = array(
				'group_id'    => 'televixo-conversations',
				'group_label' => __( 'Chat conversations', 'televixo' ),
				'item_id'     => 'televixo-' . $c['public_id'],
				'data'        => $items,
			);
		}
		if ( 1 === $page ) {
			foreach ( $ids as $vid ) {
				$v = Db::row( Db::prepare( 'SELECT * FROM {visitors} WHERE id = %d', $vid ) );
				if ( $v ) {
					$data[] = array(
						'group_id'    => 'televixo-visitor',
						'group_label' => __( 'Chat profile', 'televixo' ),
						'item_id'     => 'televixo-visitor-' . $v['public_id'],
						'data'        => array(
							array(
								'name'  => __( 'Name', 'televixo' ),
								'value' => $v['name'],
							),
							array(
								'name'  => __( 'Email', 'televixo' ),
								'value' => $v['email'],
							),
							array(
								'name'  => __( 'Phone', 'televixo' ),
								'value' => $v['phone'],
							),
							array(
								'name'  => __( 'First seen', 'televixo' ),
								'value' => Clock::iso( $v['first_seen_at'] ),
							),
							array(
								'name'  => __( 'Consent given', 'televixo' ),
								'value' => Clock::iso( $v['consent_at'] ) ?? '',
							),
						),
					);
				}
			}
		}
		return array(
			'data' => $data,
			'done' => count( $convs ) < 10,
		);
	}

	/**
	 * @return array{items_removed:bool,items_retained:bool,messages:string[],done:bool}
	 */
	public static function erase( string $email, int $page = 1 ): array {
		$ids = self::visitor_ids( $email );
		$n   = 0;
		foreach ( $ids as $vid ) {
			$n += Retention::delete_visitor( $vid );
		}
		return array(
			'items_removed'  => $n > 0 || $ids,
			'items_retained' => false,
			'messages'       => $ids ? array( __( 'Chat messages already delivered to Telegram are not removed from Telegram. Delete them there if required.', 'televixo' ) ) : array(),
			'done'           => true,
		);
	}

	/**
	 * @return array<string,mixed>
	 */
	public static function conversation_export( array $c ): array {
		$messages = Db::rows( Db::prepare( 'SELECT public_id, author_type, author_name, source, body, delivery_state, created_at FROM {messages} WHERE conversation_id = %d ORDER BY id ASC LIMIT 5000', (int) $c['id'] ) );
		$notes    = Db::rows( Db::prepare( 'SELECT author_name, body, created_at FROM {notes} WHERE conversation_id = %d ORDER BY id ASC LIMIT 2000', (int) $c['id'] ) );
		return array(
			'format'     => 'televixo-conversation',
			'reference'  => $c['reference'],
			'status'     => $c['status'],
			'created_at' => Clock::iso( $c['created_at'] ),
			'closed_at'  => Clock::iso( $c['closed_at'] ),
			'context'    => json_decode( (string) $c['context'], true ),
			'messages'   => $messages,
			'notes'      => $notes,
		);
	}

	public static function policy(): void {
		if ( ! function_exists( 'wp_add_privacy_policy_content' ) ) {
			return;
		}
		wp_add_privacy_policy_content(
			__( 'Televixo live chat', 'televixo' ),
			wp_kses_post(
				'<p>' . __( 'When you use the chat, we store your messages, any files you send, the name, email and phone number you choose to give, the page you started the chat on and the referring website (domain only). A random session cookie (televixo_session) keeps your conversation available across pages; it is not used for tracking. The chat may also store, in your browser, a first-visit date, message drafts and which chat prompts you have seen, so prompts are not repeated.', 'televixo' ) . '</p>'
				. '<p>' . __( 'Chat messages are relayed to our support team through Telegram (Telegram Messenger Inc.). Copies delivered to Telegram are subject to Telegram\'s privacy policy and are not removed when we delete your conversation from this website.', 'televixo' ) . '</p>'
				. '<p>' . __( 'Conversations are deleted automatically after the retention period set by the site owner. You can request an export or deletion of your chat data.', 'televixo' ) . '</p>'
			)
		);
	}
}
