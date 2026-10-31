<?php
/**
 * Visitor-facing routes (see docs/rest-api.md).
 *
 * @package Televixo
 */

namespace Televixo\REST;

use Televixo\Core\Settings;
use Televixo\Domain\Attachments;
use Televixo\Domain\Availability;
use Televixo\Domain\ConversationStatus;
use Televixo\Domain\Conversations;
use Televixo\Domain\DomainException;
use Televixo\Domain\Events;
use Televixo\Domain\Messages;
use Televixo\Domain\Visitors;
use Televixo\Automation\Welcome;
use Televixo\Automation\KnowledgeBase;
use Televixo\Persistence\Db;
use Televixo\Rules\Exposure;
use Televixo\Security\ClientIp;
use Televixo\Security\RateLimiter;
use Televixo\Security\SessionManager;
use Televixo\Widget\Config;

defined( 'ABSPATH' ) || exit;

final class PublicController extends Controller {

	public function register(): void {
		$id = '(?P<id>[0-9a-z]{26})';
		$this->route( '/widget/config', 'GET', array( $this, 'config' ), '__return_true' );
		$this->route( '/session', 'POST', array( $this, 'session_start' ), array( $this, 'session_permission' ) );
		$this->route( '/session', 'DELETE', array( $this, 'session_end' ), array( $this, 'visitor_write' ) );
		$this->route( '/conversations', 'POST', array( $this, 'start' ), array( $this, 'visitor_write' ) );
		$this->route( '/conversations/current', 'GET', array( $this, 'current' ), array( $this, 'visitor_read' ) );
		$this->route( "/conversations/$id/messages", 'GET', array( $this, 'messages' ), array( $this, 'visitor_read' ) );
		$this->route( "/conversations/$id/messages", 'POST', array( $this, 'send' ), array( $this, 'visitor_write' ) );
		$this->route( "/conversations/$id/updates", 'GET', array( $this, 'updates' ), array( $this, 'visitor_read' ) );
		$this->route( "/conversations/$id/attachments", 'POST', array( $this, 'upload' ), array( $this, 'visitor_write' ) );
		$this->route( "/conversations/$id/read", 'POST', array( $this, 'read' ), array( $this, 'visitor_write' ) );
		$this->route( "/conversations/$id/typing", 'POST', array( $this, 'typing' ), array( $this, 'visitor_write' ) );
		$this->route( "/conversations/$id/close", 'POST', array( $this, 'close' ), array( $this, 'visitor_write' ) );
		$this->route( "/conversations/$id/rating", 'POST', array( $this, 'rate' ), array( $this, 'visitor_write' ) );
		$this->route( "/conversations/$id/report", 'POST', array( $this, 'report' ), array( $this, 'visitor_write' ) );
		$this->route( "/conversations/$id/transcript", 'GET', array( $this, 'transcript' ), array( $this, 'visitor_read' ) );
		$this->route( "/conversations/$id/welcome", 'POST', array( $this, 'welcome_choice' ), array( $this, 'visitor_write' ) );
		$this->route( '/attachments/(?P<id>[0-9a-z]{26})', 'GET', array( $this, 'download' ), array( $this, 'attachment_permission' ) );
		$this->route( '/offline', 'POST', array( $this, 'offline' ), array( $this, 'visitor_write' ) );
		$this->route( '/kb', 'GET', array( $this, 'kb' ), '__return_true' );
		$this->route( '/triggers/(?P<rule>\d+)/events', 'POST', array( $this, 'trigger_event' ), array( $this, 'visitor_write' ) );
		$this->route( '/internal/worker', 'POST', array( $this, 'worker' ), '__return_true' );
	}

	public function config(): array {
		return Config::public_config();
	}

	/**
	 * Session creation is open to anonymous visitors but rate limited per
	 * network; renewal requires the existing cookie.
	 *
	 * @return true|\WP_Error
	 */
	public function session_permission( \WP_REST_Request $r ) {
		if ( ! Settings::get( 'widget.enabled', true ) ) {
			return self::error( 'chat_disabled', __( 'Chat is not available.', 'televixo' ), 403 );
		}
		if ( strlen( (string) $r->get_body() ) > self::MAX_JSON_BYTES ) {
			return self::error( 'payload_too_large', __( 'Request is too large.', 'televixo' ), 413 );
		}
		$ct = (array) $r->get_content_type();
		if ( 'application/json' !== ( $ct['value'] ?? '' ) ) {
			// Requiring JSON forces a CORS preflight for cross-site callers.
			return self::error( 'unsupported_media_type', __( 'JSON body required.', 'televixo' ), 415 );
		}
		return true;
	}

	public function session_start( \WP_REST_Request $r ) {
		$session = SessionManager::current();
		if ( $session ) {
			if ( (int) $session['is_blocked'] ) {
				return self::error( 'visitor_blocked', __( 'Chat is not available.', 'televixo' ), 403 );
			}
			SessionManager::touch( $session );
		} else {
			$net = ClientIp::network_hash();
			if ( Visitors::network_blocked( $net ) ) {
				return self::error( 'visitor_blocked', __( 'Chat is not available.', 'televixo' ), 403 );
			}
			if ( ! RateLimiter::hit( 'session', $net, (int) Settings::get( 'limits.sessions_per_hour', 20 ), HOUR_IN_SECONDS ) ) {
				return self::error( 'rate_limited', __( 'Too many requests. Please wait a moment.', 'televixo' ), 429 );
			}
			$session = SessionManager::create();
		}
		$visitor      = Visitors::get( (int) $session['visitor_id'] ) ?? array();
		$conversation = Conversations::active_for_visitor( (int) $session['visitor_id'] );
		$last         = $conversation ?? Conversations::latest_for_visitor( (int) $session['visitor_id'] );
		return array(
			'csrf'         => SessionManager::csrf_for( (string) $session['token'] ),
			'expires_at'   => gmdate( 'c', (int) strtotime( $session['expires_at'] . ' UTC' ) ),
			'visitor'      => array(
				'id'        => (string) $visitor['public_id'],
				'name'      => (string) $visitor['name'],
				'has_email' => '' !== (string) $visitor['email'],
			),
			'conversation' => Serializer::visitor_conversation( $last ? $this->with_rating( $last ) : null ),
			'availability' => Availability::status(),
			'context'      => Config::session_context( (int) $session['wp_user_id'] ),
		);
	}

	public function session_end() {
		$s = $this->session();
		SessionManager::revoke( (int) $s['id'] );
		SessionManager::clear_cookie();
		return array( 'ok' => true );
	}

	/**
	 * Starts or resumes a conversation; validates pre-chat fields.
	 */
	public function start( \WP_REST_Request $r ) {
		if ( '' !== self::str( $r, 'website' ) ) {
			// Honeypot filled in: treat as spam without telling the bot why.
			return self::error( 'rejected', __( 'Your message could not be sent.', 'televixo' ), 400 );
		}
		if ( true !== apply_filters( 'televixo_verify_captcha', true, $r, 'conversation' ) ) {
			return self::error( 'captcha_failed', __( 'Please complete the verification.', 'televixo' ), 400 );
		}
		$fields = $this->prechat_fields( $r );
		if ( is_wp_error( $fields ) ) {
			return $fields;
		}
		Visitors::update_profile( $this->visitor_id(), $fields );
		$conversation = Conversations::start( $this->visitor_id(), (string) ( $fields['department'] ?? '' ), Config::sanitize_context( (array) $r->get_param( 'context' ) ) );
		$welcome      = Welcome::maybe_start( $conversation );
		return array(
			'conversation' => Serializer::visitor_conversation( $conversation ),
			'welcome'      => $welcome,
		);
	}

	/**
	 * @return array<string,mixed>|\WP_Error
	 */
	private function prechat_fields( \WP_REST_Request $r ) {
		$p      = (array) Settings::get( 'prechat' );
		$out    = array();
		$errors = array();
		if ( ! $p['enabled'] ) {
			return $out;
		}
		$name = sanitize_text_field( self::str( $r, 'name', 120 ) );
		if ( 'hidden' !== $p['name'] ) {
			if ( 'required' === $p['name'] && '' === $name ) {
				$errors['name'] = __( 'Please enter your name.', 'televixo' );
			}
			$out['name'] = $name;
		}
		$email = self::str( $r, 'email', 190 );
		if ( 'hidden' !== $p['email'] ) {
			if ( '' !== $email && ! is_email( $email ) ) {
				$errors['email'] = __( 'Please enter a valid email address.', 'televixo' );
			} elseif ( 'required' === $p['email'] && '' === $email ) {
				$errors['email'] = __( 'Please enter your email address.', 'televixo' );
			}
			$out['email'] = sanitize_email( $email );
		}
		$phone = preg_replace( '/[^0-9+()\s.-]/', '', self::str( $r, 'phone', 40 ) ) ?? '';
		if ( 'hidden' !== $p['phone'] ) {
			if ( 'required' === $p['phone'] && strlen( preg_replace( '/\D/', '', $phone ) ?? '' ) < 5 ) {
				$errors['phone'] = __( 'Please enter your phone number.', 'televixo' );
			}
			$out['phone'] = $phone;
		}
		if ( 'hidden' !== $p['department'] && $p['departments'] ) {
			$dep  = sanitize_key( self::str( $r, 'department', 64 ) );
			$keys = array_column( $p['departments'], 'key' );
			if ( '' !== $dep && ! in_array( $dep, $keys, true ) ) {
				$errors['department'] = __( 'Please choose a department.', 'televixo' );
			} elseif ( 'required' === $p['department'] && '' === $dep ) {
				$errors['department'] = __( 'Please choose a department.', 'televixo' );
			}
			$out['department'] = $dep;
		}
		if ( 'hidden' !== $p['consent'] ) {
			$consent = rest_sanitize_boolean( $r->get_param( 'consent' ) );
			if ( 'required' === $p['consent'] && ! $consent ) {
				$errors['consent'] = __( 'Please accept the privacy terms to start the chat.', 'televixo' );
			}
			$out['consent']      = $consent;
			$out['consent_text'] = (string) $p['consent_text'];
		}
		$custom = (array) $r->get_param( 'fields' );
		foreach ( $p['custom_fields'] as $cf ) {
			$v = isset( $custom[ $cf['key'] ] ) && is_scalar( $custom[ $cf['key'] ] ) ? mb_substr( sanitize_textarea_field( (string) $custom[ $cf['key'] ] ), 0, 500 ) : '';
			if ( 'select' === $cf['type'] && '' !== $v && ! in_array( $v, $cf['options'], true ) ) {
				$v = '';
			}
			if ( $cf['required'] && '' === $v ) {
				/* translators: %s: field label */
				$errors[ $cf['key'] ] = sprintf( __( '%s is required.', 'televixo' ), $cf['label'] );
			}
			$out['custom'][ $cf['key'] ] = $v;
		}
		if ( $errors ) {
			return new \WP_Error( 'validation_failed', __( 'Please check the highlighted fields.', 'televixo' ), array( 'status' => 422, 'fields' => $errors ) );
		}
		return $out;
	}

	public function current() {
		$c = Conversations::active_for_visitor( $this->visitor_id() ) ?? Conversations::latest_for_visitor( $this->visitor_id() );
		return array( 'conversation' => Serializer::visitor_conversation( $c ? $this->with_rating( $c ) : null ) );
	}

	private function owned( \WP_REST_Request $r ): array {
		return Conversations::for_visitor( (string) $r['id'], $this->visitor_id() );
	}

	public function messages( \WP_REST_Request $r ) {
		$c    = $this->owned( $r );
		$page = Messages::page( (int) $c['id'], absint( $r->get_param( 'after' ) ), absint( $r->get_param( 'before' ) ), absint( $r->get_param( 'limit' ) ?: 30 ) );
		return array(
			'items'    => Serializer::visitor_messages( $page['items'], $c ),
			'has_more' => $page['has_more'],
		);
	}

	/**
	 * Polling endpoint: messages after a cursor plus conversation state.
	 */
	public function updates( \WP_REST_Request $r ) {
		$c     = $this->owned( $r );
		$after = absint( $r->get_param( 'after' ) );
		$page  = Messages::page( (int) $c['id'], $after, 0, Messages::PAGE_MAX );
		SessionManager::touch( $this->session() );
		return array(
			'items'        => Serializer::visitor_messages( $page['items'], $c ),
			'has_more'     => $page['has_more'],
			'conversation' => Serializer::visitor_conversation( $this->with_rating( $c ) ),
			'availability' => Availability::status( $c['team_id'] ? (int) $c['team_id'] : null ),
		);
	}

	public function send( \WP_REST_Request $r ) {
		$s = $this->session();
		if ( ! RateLimiter::hit( 'msg', 's' . $s['id'], (int) Settings::get( 'limits.messages_per_minute', 20 ), MINUTE_IN_SECONDS )
			|| ! RateLimiter::hit( 'msg_net', ClientIp::network_hash(), 3 * (int) Settings::get( 'limits.messages_per_minute', 20 ), MINUTE_IN_SECONDS ) ) {
			return self::error( 'rate_limited', __( 'You are sending messages too quickly. Please wait a moment.', 'televixo' ), 429 );
		}
		$c    = $this->owned( $r );
		$body = $r->get_param( 'body' );
		if ( null !== $body && ! is_string( $body ) ) {
			return self::error( 'invalid_body', __( 'Invalid message.', 'televixo' ), 400 );
		}
		$atts   = Attachments::resolve_owned( (array) $r->get_param( 'attachments' ), (int) $c['id'], $this->visitor_id() );
		$result = Messages::create_visitor_message( $c, $this->visitor_id(), (string) $body, self::str( $r, 'client_id', 64 ), $atts );
		Welcome::on_visitor_message( $c );
		$fresh  = Conversations::get( (int) $c['id'] ) ?? $c;
		$atts_r = Attachments::for_messages( array( (int) $result['message']['id'] ) );
		$resp   = new \WP_REST_Response(
			array(
				'message'      => Serializer::visitor_message( $result['message'], $fresh, $atts_r[ (int) $result['message']['id'] ] ?? array() ),
				'duplicate'    => $result['duplicate'],
				'conversation' => Serializer::visitor_conversation( $fresh ),
			),
			$result['duplicate'] ? 200 : 201
		);
		return $resp;
	}

	public function upload( \WP_REST_Request $r ) {
		if ( ! Settings::get( 'uploads.enabled', true ) ) {
			return self::error( 'uploads_disabled', __( 'File uploads are disabled.', 'televixo' ), 403 );
		}
		$s = $this->session();
		if ( ! RateLimiter::hit( 'upload', 's' . $s['id'], (int) Settings::get( 'limits.uploads_per_hour', 20 ), HOUR_IN_SECONDS ) ) {
			return self::error( 'rate_limited', __( 'Too many uploads. Please wait.', 'televixo' ), 429 );
		}
		$c     = $this->owned( $r );
		$files = $r->get_file_params();
		$file  = $files['file'] ?? null;
		if ( ! is_array( $file ) || UPLOAD_ERR_OK !== (int) ( $file['error'] ?? UPLOAD_ERR_NO_FILE ) ) {
			$code = is_array( $file ) && in_array( (int) $file['error'], array( UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE ), true ) ? 'file_too_large' : 'file_missing';
			return self::error( $code, 'file_too_large' === $code ? Attachments::error_text( $code ) : __( 'No file received.', 'televixo' ), 'file_too_large' === $code ? 413 : 400 );
		}
		$att = Attachments::store( $c, (string) $file['tmp_name'], (string) $file['name'], 'visitor', $this->visitor_id(), ! ( defined( 'TELEVIXO_TESTING' ) && TELEVIXO_TESTING ) );
		return new \WP_REST_Response( array( 'attachment' => Serializer::attachment( $att ) ), 201 );
	}

	/**
	 * Attachment bytes: the visitor who owns the conversation, or an operator
	 * with access to it (wp_rest nonce or cookie on admin pages).
	 *
	 * @return true|\WP_Error
	 */
	public function attachment_permission( \WP_REST_Request $r ) {
		$att = Attachments::by_public_id( (string) $r['id'] );
		if ( $att ) {
			$conv = Conversations::get( (int) $att['conversation_id'] );
			$s    = SessionManager::current();
			if ( $conv && $s && ! (int) $s['is_blocked'] && (int) $conv['visitor_id'] === (int) $s['visitor_id'] && ( 'ready' === $att['status'] || 'visitor' === $att['uploader_type'] ) ) {
				return true;
			}
			if ( $conv && is_user_logged_in() ) {
				$op = \Televixo\Domain\Operators::for_user( get_current_user_id() );
				if ( $op && \Televixo\Domain\Operators::can_access( $op, $conv ) ) {
					return true;
				}
			}
		}
		return self::error( 'attachment_not_found', __( 'File not found.', 'televixo' ), 404 );
	}

	public function download( \WP_REST_Request $r ) {
		$att = Attachments::by_public_id( (string) $r['id'] );
		Attachments::stream( (array) $att, rest_sanitize_boolean( $r->get_param( 'inline' ) ) );
		return null; // Not reached.
	}

	public function read( \WP_REST_Request $r ) {
		$c = $this->owned( $r );
		Conversations::mark_read( (int) $c['id'], 'visitor', min( absint( $r->get_param( 'cursor' ) ), (int) $c['last_message_id'] ) );
		return array( 'ok' => true );
	}

	public function typing( \WP_REST_Request $r ) {
		$c = $this->owned( $r );
		if ( RateLimiter::hit( 'typing', 's' . $this->session()['id'], 30, MINUTE_IN_SECONDS ) ) {
			Conversations::set_typing( (int) $c['id'], 'visitor' );
		}
		return array( 'ok' => true );
	}

	public function close( \WP_REST_Request $r ) {
		$c = $this->owned( $r );
		if ( ConversationStatus::from( (string) $c['status'] )->is_active() ) {
			$c = Conversations::close( $c, 'visitor', (string) $this->visitor_id() );
		}
		return array( 'conversation' => Serializer::visitor_conversation( $this->with_rating( $c ) ) );
	}

	public function rate( \WP_REST_Request $r ) {
		if ( ! Settings::get( 'csat.enabled', true ) ) {
			return self::error( 'csat_disabled', __( 'Ratings are disabled.', 'televixo' ), 403 );
		}
		$c     = $this->owned( $r );
		$score = (int) $r->get_param( 'score' );
		if ( $score < 1 || $score > 5 ) {
			return self::error( 'invalid_score', __( 'Please choose a rating from 1 to 5.', 'televixo' ), 422 );
		}
		$comment = Settings::get( 'csat.comment', true ) ? mb_substr( sanitize_textarea_field( (string) $r->get_param( 'comment' ) ), 0, 1000 ) : '';
		$id      = Db::insert_ignore_duplicate(
			'ratings',
			array(
				'conversation_id' => (int) $c['id'],
				'visitor_id'      => $this->visitor_id(),
				'score'           => $score,
				'comment'         => $comment,
				'created_at'      => \Televixo\Core\Clock::mysql(),
			)
		);
		if ( 0 === $id ) {
			return self::error( 'already_rated', __( 'You already rated this conversation.', 'televixo' ), 409 );
		}
		return new \WP_REST_Response( array( 'ok' => true ), 201 );
	}

	public function report( \WP_REST_Request $r ) {
		$c = $this->owned( $r );
		Events::record( 'visitor.report', 'visitor', (string) $this->visitor_id(), (int) $c['id'], '', '', array( 'reason' => mb_substr( sanitize_text_field( (string) $r->get_param( 'reason' ) ), 0, 200 ) ) );
		return array( 'ok' => true );
	}

	/**
	 * Plain-text transcript of public messages, ownership checked. Internal
	 * notes are stored separately and never included.
	 */
	public function transcript( \WP_REST_Request $r ) {
		if ( ! Settings::get( 'privacy.transcript_download', true ) ) {
			return self::error( 'transcript_disabled', __( 'Transcripts are disabled.', 'televixo' ), 403 );
		}
		$c = $this->owned( $r );
		\Televixo\Privacy\Transcript::send( $c );
		return null;
	}

	public function welcome_choice( \WP_REST_Request $r ) {
		$c = $this->owned( $r );
		return Welcome::choose( $c, absint( $r->get_param( 'option' ) ) );
	}

	/**
	 * Offline form: stored as an offline conversation with the visitor's
	 * message; optionally emailed to the configured address.
	 */
	public function offline( \WP_REST_Request $r ) {
		if ( '' !== self::str( $r, 'website' ) ) {
			return self::error( 'rejected', __( 'Your message could not be sent.', 'televixo' ), 400 );
		}
		if ( ! RateLimiter::hit( 'offline', ClientIp::network_hash(), 5, HOUR_IN_SECONDS ) ) {
			return self::error( 'rate_limited', __( 'Too many requests. Please try again later.', 'televixo' ), 429 );
		}
		if ( true !== apply_filters( 'televixo_verify_captcha', true, $r, 'offline' ) ) {
			return self::error( 'captcha_failed', __( 'Please complete the verification.', 'televixo' ), 400 );
		}
		$email   = self::str( $r, 'email', 190 );
		$message = (string) $r->get_param( 'message' );
		$errors  = array();
		if ( ! is_email( $email ) ) {
			$errors['email'] = __( 'Please enter a valid email address.', 'televixo' );
		}
		if ( '' === trim( $message ) ) {
			$errors['message'] = __( 'Please enter a message.', 'televixo' );
		}
		if ( $errors ) {
			return new \WP_Error( 'validation_failed', __( 'Please check the highlighted fields.', 'televixo' ), array( 'status' => 422, 'fields' => $errors ) );
		}
		Visitors::update_profile( $this->visitor_id(), array( 'name' => sanitize_text_field( self::str( $r, 'name', 120 ) ), 'email' => sanitize_email( $email ) ) );
		$c      = Conversations::start( $this->visitor_id(), '', Config::sanitize_context( (array) $r->get_param( 'context' ) ), true );
		$result = Messages::create_visitor_message( $c, $this->visitor_id(), mb_substr( $message, 0, 4000 ), self::str( $r, 'client_id', 64 ) ?: \Televixo\Security\Random::secret( 12 ) );
		$notify = (string) Settings::get( 'offline.notify_email', '' );
		if ( '' !== $notify ) {
			wp_mail(
				$notify,
				/* translators: %s: conversation reference */
				sprintf( __( 'New offline message %s', 'televixo' ), $c['reference'] ),
				/* translators: 1: visitor email, 2: message */
				sprintf( __( "From: %1\$s\n\n%2\$s\n\nReply from the Televixo inbox in WordPress.", 'televixo' ), sanitize_email( $email ), Messages::normalize_body( $message ) )
			);
		}
		return new \WP_REST_Response( array( 'ok' => true, 'conversation' => Serializer::visitor_conversation( Conversations::get( (int) $c['id'] ) ), 'message' => $result['message']['public_id'] ?? '' ), 201 );
	}

	public function kb( \WP_REST_Request $r ) {
		return array( 'items' => KnowledgeBase::search( self::str( $r, 'q', 100 ) ) );
	}

	public function trigger_event( \WP_REST_Request $r ) {
		$s = $this->session();
		if ( ! RateLimiter::hit( 'trigger', 's' . $s['id'], 60, HOUR_IN_SECONDS ) ) {
			return self::error( 'rate_limited', __( 'Too many requests.', 'televixo' ), 429 );
		}
		Exposure::record( absint( $r['rule'] ), (int) $s['visitor_id'], sanitize_key( self::str( $r, 'action', 32 ) ), sanitize_key( self::str( $r, 'outcome', 16 ) ) );
		return array( 'ok' => true );
	}

	public function worker( \WP_REST_Request $r ) {
		if ( ! \Televixo\Queue\Scheduler::verify( absint( $r->get_param( 'ts' ) ), self::str( $r, 'sig', 64 ) ) ) {
			return self::error( 'forbidden', 'Forbidden', 403 );
		}
		ignore_user_abort( true );
		\Televixo\Queue\Worker::run( 10.0 );
		return array( 'ok' => true );
	}

	private function with_rating( array $c ): array {
		$c['rated'] = (bool) Db::var( Db::prepare( 'SELECT 1 FROM {ratings} WHERE conversation_id = %d', (int) $c['id'] ) );
		return $c;
	}
}
