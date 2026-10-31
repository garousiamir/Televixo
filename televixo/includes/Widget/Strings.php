<?php
/**
 * Translated widget strings, delivered with the widget bootstrap so the
 * front end needs no i18n runtime. Plural forms are passed with the active
 * locale's gettext Plural-Forms expression, evaluated by a small safe parser
 * in the widget (assets-src/widget/i18n.ts).
 *
 * @package Televixo
 */

namespace Televixo\Widget;

defined( 'ABSPATH' ) || exit;

final class Strings {

	/**
	 * @return array{s:array<string,string>,p:array<string,string[]>,plural:string}
	 */
	public static function widget(): array {
		return array(
			's'      => self::singulars(),
			'p'      => array(
				/* translators: %d: number of unread messages */
				'unread'   => self::forms( _n_noop( '%d new message', '%d new messages', 'televixo' ) ),
				/* translators: %d: number of minutes */
				'minutes'  => self::forms( _n_noop( '%d minute', '%d minutes', 'televixo' ) ),
			),
			'plural' => self::plural_expression(),
		);
	}

	/**
	 * @param array<string,mixed> $noop
	 * @return string[]
	 */
	private static function forms( array $noop ): array {
		$t   = get_translations_for_domain( 'televixo' );
		$key = $noop['singular'];
		if ( isset( $t->entries ) && is_array( $t->entries ) && ! empty( $t->entries[ $key ]->translations ) ) {
			return array_values( array_map( 'strval', $t->entries[ $key ]->translations ) );
		}
		// No MO entry (English or untranslated): use the source forms.
		return array( translate_nooped_plural( $noop, 1, 'televixo' ), translate_nooped_plural( $noop, 2, 'televixo' ) );
	}

	private static function plural_expression(): string {
		$t = get_translations_for_domain( 'televixo' );
		$h = isset( $t->headers['Plural-Forms'] ) ? (string) $t->headers['Plural-Forms'] : '';
		if ( preg_match( '/plural\s*=\s*([^;]+);?/', $h, $m ) ) {
			return trim( $m[1] );
		}
		return 'n != 1';
	}

	/**
	 * @return array<string,string>
	 */
	private static function singulars(): array {
		return array(
			'open'            => __( 'Open chat', 'televixo' ),
			'close'           => __( 'Close chat', 'televixo' ),
			'minimize'        => __( 'Minimize chat', 'televixo' ),
			'expand'          => __( 'Expand chat', 'televixo' ),
			'collapse'        => __( 'Collapse chat', 'televixo' ),
			'send'            => __( 'Send', 'televixo' ),
			'placeholder'     => __( 'Type your message…', 'televixo' ),
			'input_label'     => __( 'Type your message', 'televixo' ),
			'attach'          => __( 'Attach a file', 'televixo' ),
			'record'          => __( 'Record a voice message', 'televixo' ),
			'stop_record'     => __( 'Stop recording', 'televixo' ),
			'cancel'          => __( 'Cancel', 'televixo' ),
			'retry'           => __( 'Retry', 'televixo' ),
			'remove'          => __( 'Remove', 'televixo' ),
			'online'          => __( 'Online now', 'televixo' ),
			'offline'         => __( 'Offline', 'televixo' ),
			'away'            => __( 'Away', 'televixo' ),
			'closed_now'      => __( 'Closed now', 'televixo' ),
			/* translators: %s: localized date and time */
			'opens_at'        => __( 'Opens %s', 'televixo' ),
			'scheduled'       => __( 'Within business hours', 'televixo' ),
			'connecting'      => __( 'Connecting…', 'televixo' ),
			'reconnecting'    => __( 'Connection lost. Reconnecting…', 'televixo' ),
			'connected'       => __( 'Connected', 'televixo' ),
			'sending'         => __( 'Sending…', 'televixo' ),
			'sent'            => __( 'Sent', 'televixo' ),
			'delivered'       => __( 'Delivered to the team', 'televixo' ),
			'read'            => __( 'Seen', 'televixo' ),
			'failed'          => __( 'Not sent', 'televixo' ),
			'typing'          => __( 'An operator is typing…', 'televixo' ),
			'today'           => __( 'Today', 'televixo' ),
			'yesterday'       => __( 'Yesterday', 'televixo' ),
			'load_older'      => __( 'Load earlier messages', 'televixo' ),
			'latest'          => __( 'Scroll to latest', 'televixo' ),
			'automated'       => __( 'Automated message', 'televixo' ),
			'you'             => __( 'You', 'televixo' ),
			'team'            => __( 'Support', 'televixo' ),
			'start_chat'      => __( 'Start chat', 'televixo' ),
			'name'            => __( 'Name', 'televixo' ),
			'email'           => __( 'Email', 'televixo' ),
			'phone'           => __( 'Phone', 'televixo' ),
			'department'      => __( 'Department', 'televixo' ),
			'choose'          => __( 'Choose…', 'televixo' ),
			'optional'        => __( '(optional)', 'televixo' ),
			'required'        => __( 'Required', 'televixo' ),
			'message'         => __( 'Message', 'televixo' ),
			'leave_message'   => __( 'Leave a message', 'televixo' ),
			'offline_sent'    => __( 'Thanks! We received your message and will reply by email.', 'televixo' ),
			'end_chat'        => __( 'End chat', 'televixo' ),
			'end_confirm'     => __( 'End this conversation?', 'televixo' ),
			'chat_ended'      => __( 'This conversation has ended.', 'televixo' ),
			'new_chat'        => __( 'Start a new conversation', 'televixo' ),
			'rate'            => __( 'How was this conversation?', 'televixo' ),
			/* translators: %d: star rating 1-5 */
			'rate_n'          => __( 'Rate %d out of 5', 'televixo' ),
			'rate_comment'    => __( 'Anything we could do better? (optional)', 'televixo' ),
			'rate_submit'     => __( 'Send rating', 'televixo' ),
			'rate_thanks'     => __( 'Thank you for your feedback!', 'televixo' ),
			'transcript'      => __( 'Download transcript', 'televixo' ),
			'report'          => __( 'Report abuse', 'televixo' ),
			'report_done'     => __( 'Thanks, the team has been notified.', 'televixo' ),
			'search_help'     => __( 'Search help articles', 'televixo' ),
			'no_results'      => __( 'No articles found.', 'televixo' ),
			'back'            => __( 'Back', 'televixo' ),
			'help'            => __( 'Help articles', 'televixo' ),
			'talk_to_human'   => __( 'Talk to a person', 'televixo' ),
			'queued'          => __( 'You are in the queue. A team member will reply as soon as possible.', 'televixo' ),
			'sound_on'        => __( 'Turn sound on', 'televixo' ),
			'sound_off'       => __( 'Turn sound off', 'televixo' ),
			'notify_ask'      => __( 'Get a browser notification when we reply?', 'televixo' ),
			'notify_yes'      => __( 'Notify me', 'televixo' ),
			'notify_no'       => __( 'No thanks', 'televixo' ),
			/* translators: %s: site name */
			'notify_title'    => __( 'New reply from %s', 'televixo' ),
			'file_too_large'  => __( 'The file is too large.', 'televixo' ),
			'file_type'       => __( 'This file type is not allowed.', 'televixo' ),
			'upload_failed'   => __( 'Upload failed.', 'televixo' ),
			'uploading'       => __( 'Uploading…', 'televixo' ),
			'mic_denied'      => __( 'Microphone access was denied. You can attach a file or type instead.', 'televixo' ),
			'error_generic'   => __( 'Something went wrong. Please try again.', 'televixo' ),
			'rate_limited'    => __( 'You are sending messages too quickly. Please wait a moment.', 'televixo' ),
			'session_expired' => __( 'Your chat session has expired. Please reload the page.', 'televixo' ),
			'blocked'         => __( 'Chat is not available.', 'televixo' ),
			'dismiss'         => __( 'Dismiss', 'televixo' ),
			'chat_window'     => __( 'Chat', 'televixo' ),
			'messages'        => __( 'Messages', 'televixo' ),
			'image'           => __( 'Image', 'televixo' ),
			'file'            => __( 'File', 'televixo' ),
			'voice'           => __( 'Voice message', 'televixo' ),
			'emoji'           => __( 'Insert emoji', 'televixo' ),
			'new_message'     => __( 'New message', 'televixo' ),
			'consent'         => __( 'I agree to the processing of my data for this chat.', 'televixo' ),
			'more'            => __( 'More options', 'televixo' ),
		);
	}
}
