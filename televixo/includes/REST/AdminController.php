<?php
/**
 * Authenticated admin/operator routes. WordPress cookie authentication
 * requires the wp_rest nonce (X-WP-Nonce), which provides CSRF protection;
 * each route additionally checks a Televixo capability and, for
 * conversation routes, conversation-level access.
 *
 * @package Televixo
 */

namespace Televixo\REST;

use Televixo\Automation\KnowledgeBase;
use Televixo\Core\Clock;
use Televixo\Core\Settings;
use Televixo\Domain\Assignment;
use Televixo\Domain\Attachments;
use Televixo\Domain\ConversationStatus;
use Televixo\Domain\Conversations;
use Televixo\Domain\DomainException;
use Televixo\Domain\Events;
use Televixo\Domain\Messages;
use Televixo\Domain\Operators;
use Televixo\Domain\Visitors;
use Televixo\Persistence\Db;
use Televixo\Privacy\Retention;
use Televixo\Queue\Outbox;
use Televixo\Queue\Worker;
use Televixo\Reporting\Reports;
use Televixo\Rules\Engine;
use Televixo\Rules\Repository as Rules;
use Televixo\Rules\Schema as RuleSchema;
use Televixo\Security\Capabilities as Caps;

defined( 'ABSPATH' ) || exit;

final class AdminController extends Controller {

	public function register(): void {
		$c     = '(?P<id>[0-9a-z]{26})';
		$inbox = $this->cap( Caps::HANDLE_ASSIGNED, Caps::VIEW_ALL );
		$set   = $this->cap( Caps::MANAGE_SETTINGS );

		$this->route( '/admin/me', 'GET', array( $this, 'me' ), $inbox );
		$this->route( '/admin/heartbeat', 'POST', array( $this, 'heartbeat' ), $inbox );
		$this->route( '/admin/conversations', 'GET', array( $this, 'list' ), $inbox );
		$this->route( "/admin/conversations/$c", 'GET', array( $this, 'detail' ), $inbox );
		$this->route( "/admin/conversations/$c", 'DELETE', array( $this, 'delete' ), $this->cap( Caps::DELETE ) );
		$this->route( "/admin/conversations/$c/messages", 'GET', array( $this, 'messages' ), $inbox );
		$this->route( "/admin/conversations/$c/messages", 'POST', array( $this, 'reply' ), $inbox );
		$this->route( "/admin/conversations/$c/attachments", 'POST', array( $this, 'upload' ), $inbox );
		$this->route( "/admin/conversations/$c/notes", 'GET', array( $this, 'notes' ), $inbox );
		$this->route( "/admin/conversations/$c/notes", 'POST', array( $this, 'add_note' ), $inbox );
		$this->route( "/admin/conversations/$c/claim", 'POST', array( $this, 'claim' ), $inbox );
		$this->route( "/admin/conversations/$c/assign", 'POST', array( $this, 'assign' ), $inbox );
		$this->route( "/admin/conversations/$c/unassign", 'POST', array( $this, 'unassign' ), $inbox );
		$this->route( "/admin/conversations/$c/status", 'POST', array( $this, 'status' ), $inbox );
		$this->route( "/admin/conversations/$c/meta", 'POST', array( $this, 'meta' ), $inbox );
		$this->route( "/admin/conversations/$c/typing", 'POST', array( $this, 'typing' ), $inbox );
		$this->route( "/admin/conversations/$c/read", 'POST', array( $this, 'read' ), $inbox );
		$this->route( "/admin/conversations/$c/export", 'GET', array( $this, 'export' ), $this->cap( Caps::EXPORT ) );
		$this->route( '/admin/visitors/(?P<vid>[0-9a-z]{26})/block', 'POST', array( $this, 'block' ), $inbox );
		$this->route( '/admin/visitors/(?P<vid>[0-9a-z]{26})/unblock', 'POST', array( $this, 'unblock' ), $set );
		$this->route( '/admin/tags', 'GET', array( $this, 'tags' ), $inbox );
		$this->route( '/admin/canned', 'GET', array( $this, 'canned' ), $inbox );
		$this->route( '/admin/canned', 'POST', array( $this, 'save_canned' ), $set );
		$this->route( '/admin/canned/(?P<n>\d+)', 'DELETE', array( $this, 'delete_canned' ), $set );

		$this->route( '/admin/operators', 'GET', array( $this, 'operators' ), $inbox );
		$this->route( '/admin/operators', 'POST', array( $this, 'add_operator' ), $set );
		$this->route( '/admin/operators/(?P<n>\d+)', 'POST', array( $this, 'update_operator' ), $set );
		$this->route( '/admin/operators/(?P<n>\d+)/challenge', 'POST', array( $this, 'challenge' ), $inbox );
		$this->route( '/admin/operators/(?P<n>\d+)/telegram', 'DELETE', array( $this, 'unlink' ), $inbox );
		$this->route( '/admin/teams', 'GET', array( $this, 'teams' ), $inbox );
		$this->route( '/admin/teams', 'POST', array( $this, 'save_team' ), $set );
		$this->route( '/admin/teams/(?P<n>\d+)', 'DELETE', array( $this, 'delete_team' ), $set );
		$this->route( '/admin/kb', 'GET', array( $this, 'kb' ), $inbox );
		$this->route( '/admin/kb', 'POST', array( $this, 'save_kb' ), $set );
		$this->route( '/admin/kb/(?P<n>\d+)', 'DELETE', array( $this, 'delete_kb' ), $set );

		$this->route( '/admin/rules', 'GET', array( $this, 'rules' ), $set );
		$this->route( '/admin/rules', 'POST', array( $this, 'save_rule' ), $set );
		$this->route( '/admin/rules/(?P<n>\d+)', 'DELETE', array( $this, 'delete_rule' ), $set );
		$this->route( '/admin/rules/preview', 'POST', array( $this, 'preview_rules' ), $set );
		$this->route( '/admin/rules/export', 'GET', array( $this, 'export_rules' ), $set );
		$this->route( '/admin/rules/import', 'POST', array( $this, 'import_rules' ), $set );
		$this->route( '/admin/rules/schema', 'GET', array( $this, 'rule_schema' ), $set );

		$this->route( '/admin/settings', 'GET', array( $this, 'settings' ), $set );
		$this->route( '/admin/settings', 'POST', array( $this, 'save_settings' ), $set );
		$this->route( '/admin/settings/export', 'GET', array( $this, 'export_settings' ), $set );
		$this->route( '/admin/settings/import', 'POST', array( $this, 'import_settings' ), $set );

		$this->route( '/admin/reports', 'GET', array( $this, 'reports' ), $this->cap( Caps::VIEW_REPORTS ) );
		$this->route( '/admin/queue', 'GET', array( $this, 'queue' ), $set );
		$this->route( '/admin/queue/(?P<n>\d+)/retry', 'POST', array( $this, 'queue_retry' ), $set );
		$this->route( '/admin/queue/(?P<n>\d+)/discard', 'POST', array( $this, 'queue_discard' ), $set );
		$this->route( '/admin/queue/run', 'POST', array( $this, 'queue_run' ), $set );
		$this->route( '/admin/privacy/run-retention', 'POST', array( $this, 'run_retention' ), $this->cap( Caps::DELETE ) );
	}

	/**
	 * @return callable(\WP_REST_Request):(true|\WP_Error)
	 */
	private function cap( string ...$caps ): callable {
		return static function () use ( $caps ) {
			foreach ( $caps as $cap ) {
				if ( current_user_can( $cap ) ) {
					return true;
				}
			}
			return self::error( 'forbidden', __( 'You do not have permission to do this.', 'televixo' ), is_user_logged_in() ? 403 : 401 );
		};
	}

	private function operator(): array {
		$op = Operators::for_user( get_current_user_id() );
		if ( ! $op || 'active' !== $op['status'] ) {
			throw new DomainException( 'operator_disabled', __( 'Your operator account is disabled.', 'televixo' ), 403 );
		}
		return $op;
	}

	/**
	 * Conversation the current operator may access. Not-found and forbidden
	 * look the same to avoid leaking existence.
	 */
	private function conversation( \WP_REST_Request $r ): array {
		$c = Conversations::by_public_id( (string) $r['id'] );
		if ( ! $c || ! Operators::can_access( $this->operator(), $c ) ) {
			throw new DomainException( 'conversation_not_found', __( 'Conversation not found.', 'televixo' ), 404 );
		}
		return $c;
	}

	public function me() {
		$op = $this->operator();
		return array(
			'operator' => $this->op_shape( $op ),
			'caps'     => array_values( array_filter( Caps::ALL, 'current_user_can' ) ),
			'telegram' => array( 'bot_username' => (string) Settings::get( 'telegram.bot_username' ) ),
		);
	}

	public function heartbeat( \WP_REST_Request $r ) {
		$op    = $this->operator();
		$avail = self::str( $r, 'availability', 16 );
		if ( '' !== $avail ) {
			Operators::set_availability( (int) $op['id'], $avail );
		}
		Operators::heartbeat( (int) $op['id'] );
		return array( 'operator' => $this->op_shape( Operators::get( (int) $op['id'] ) ?? $op ), 'unread' => $this->unread_total( $op ) );
	}

	private function unread_total( array $op ): int {
		[ $where, $args ] = $this->scope_sql( $op, array( 'status' => 'active' ) );
		return (int) Db::var(
			Db::prepare(
				"SELECT COUNT(*) FROM {conversations} c JOIN {visitors} v ON v.id = c.visitor_id WHERE $where AND EXISTS (SELECT 1 FROM {messages} m WHERE m.conversation_id = c.id AND m.author_type = 'visitor' AND m.id > c.operator_read_id)",
				...$args
			)
		);
	}

	/**
	 * @param array<string,mixed> $f
	 * @return array{0:string,1:array<int,mixed>}
	 */
	private function scope_sql( array $op, array $f ): array {
		$where = array( '1=1' );
		$args  = array();
		if ( ! Operators::can_view_all( $op ) ) {
			$teams = Operators::team_ids( (int) $op['id'] );
			$where[] = '(c.assigned_operator_id = %d OR (c.assigned_operator_id IS NULL AND (c.team_id IS NULL OR c.team_id IN (' . Db::in_ints( $teams ) . '))))';
			$args[]  = (int) $op['id'];
		}
		$status = (string) ( $f['status'] ?? '' );
		if ( 'active' === $status ) {
			$where[] = "c.status NOT IN ('closed','spam')";
		} elseif ( in_array( $status, array_map( static fn( $s ) => $s->value, ConversationStatus::cases() ), true ) ) {
			$where[] = 'c.status = %s';
			$args[]  = $status;
		}
		$assigned = (string) ( $f['assigned'] ?? '' );
		if ( 'me' === $assigned ) {
			$where[] = 'c.assigned_operator_id = %d';
			$args[]  = (int) $op['id'];
		} elseif ( 'unassigned' === $assigned ) {
			$where[] = 'c.assigned_operator_id IS NULL';
		}
		if ( ! empty( $f['team'] ) ) {
			$where[] = 'c.team_id = %d';
			$args[]  = (int) $f['team'];
		}
		if ( ! empty( $f['priority'] ) ) {
			$where[] = 'c.priority = %d';
			$args[]  = (int) $f['priority'];
		}
		if ( ! empty( $f['tag'] ) ) {
			$where[] = 'EXISTS (SELECT 1 FROM {conversation_tags} ct WHERE ct.conversation_id = c.id AND ct.tag_id = %d)';
			$args[]  = (int) $f['tag'];
		}
		if ( ! empty( $f['q'] ) ) {
			$like    = '%' . Db::wpdb()->esc_like( (string) $f['q'] ) . '%';
			$where[] = '(c.reference LIKE %s OR v.name LIKE %s OR v.email LIKE %s)';
			array_push( $args, $like, $like, $like );
		}
		return array( implode( ' AND ', $where ), $args );
	}

	/**
	 * Inbox list with keyset pagination on (last activity, id).
	 */
	public function list( \WP_REST_Request $r ) {
		$op    = $this->operator();
		$limit = max( 1, min( 50, absint( $r->get_param( 'limit' ) ?: 25 ) ) );
		$f     = array(
			'status'   => self::str( $r, 'status', 16 ) ?: 'active',
			'assigned' => self::str( $r, 'assigned', 16 ),
			'team'     => absint( $r->get_param( 'team' ) ),
			'priority' => absint( $r->get_param( 'priority' ) ),
			'tag'      => absint( $r->get_param( 'tag' ) ),
			'q'        => self::str( $r, 'q', 100 ),
		);
		[ $where, $args ] = $this->scope_sql( $op, $f );
		$cursor = self::str( $r, 'cursor', 64 );
		if ( preg_match( '/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})_(\d+)$/', str_replace( 'T', ' ', $cursor ), $m ) ) {
			$where .= ' AND (c.last_message_at < %s OR (c.last_message_at = %s AND c.id < %d))';
			array_push( $args, $m[1], $m[1], (int) $m[2] );
		}
		$args[] = $limit + 1;
		$rows   = Db::rows(
			Db::prepare(
				"SELECT c.*, v.name AS visitor_name, v.email AS visitor_email, v.public_id AS visitor_public_id, v.is_blocked,
					(SELECT COUNT(*) FROM {messages} m WHERE m.conversation_id = c.id AND m.author_type = 'visitor' AND m.id > c.operator_read_id) AS unread,
					(SELECT m2.body FROM {messages} m2 WHERE m2.id = c.last_message_id) AS last_body
				FROM {conversations} c JOIN {visitors} v ON v.id = c.visitor_id
				WHERE $where ORDER BY c.last_message_at DESC, c.id DESC LIMIT %d",
				...$args
			)
		);
		$more = count( $rows ) > $limit;
		$rows = array_slice( $rows, 0, $limit );
		$last = end( $rows );
		return array(
			'items'       => array_map( array( $this, 'conv_shape' ), $rows ),
			'next_cursor' => $more && $last ? str_replace( ' ', 'T', (string) $last['last_message_at'] ) . '_' . $last['id'] : null,
			'unread'      => $this->unread_total( $op ),
		);
	}

	public function detail( \WP_REST_Request $r ) {
		$c       = $this->conversation( $r );
		$visitor = Visitors::get( (int) $c['visitor_id'] ) ?? array();
		$history = Db::rows( Db::prepare( 'SELECT public_id, reference, status, created_at FROM {conversations} WHERE visitor_id = %d AND id <> %d ORDER BY id DESC LIMIT 10', (int) $c['visitor_id'], (int) $c['id'] ) );
		$rating  = Db::row( Db::prepare( 'SELECT score, comment, created_at FROM {ratings} WHERE conversation_id = %d', (int) $c['id'] ) );
		$c['visitor_name']      = $visitor['name'] ?? '';
		$c['visitor_email']     = $visitor['email'] ?? '';
		$c['visitor_public_id'] = $visitor['public_id'] ?? '';
		$c['is_blocked']        = $visitor['is_blocked'] ?? 0;
		$c['unread']            = 0;
		return array(
			'conversation' => $this->conv_shape( $c ),
			'visitor'      => array(
				'id'            => (string) ( $visitor['public_id'] ?? '' ),
				'name'          => (string) ( $visitor['name'] ?? '' ),
				'email'         => (string) ( $visitor['email'] ?? '' ),
				'phone'         => (string) ( $visitor['phone'] ?? '' ),
				'wp_user_id'    => (int) ( $visitor['wp_user_id'] ?? 0 ),
				'custom_fields' => json_decode( (string) ( $visitor['custom_fields'] ?? '' ), true ) ?: new \stdClass(),
				'blocked'       => (bool) ( $visitor['is_blocked'] ?? false ),
				'first_seen_at' => Clock::iso( $visitor['first_seen_at'] ?? null ),
				'consent_at'    => Clock::iso( $visitor['consent_at'] ?? null ),
			),
			'context'      => Conversations::context( $c ),
			'routing'      => Conversations::snapshot( $c ),
			'history'      => array_map( static fn( $h ) => array( 'id' => $h['public_id'], 'reference' => $h['reference'], 'status' => $h['status'], 'created_at' => Clock::iso( $h['created_at'] ) ), $history ),
			'rating'       => $rating ? array( 'score' => (int) $rating['score'], 'comment' => (string) $rating['comment'] ) : null,
			'tags'         => $this->conv_tags( (int) $c['id'] ),
		);
	}

	public function messages( \WP_REST_Request $r ) {
		$c    = $this->conversation( $r );
		$page = Messages::page( (int) $c['id'], absint( $r->get_param( 'after' ) ), absint( $r->get_param( 'before' ) ), absint( $r->get_param( 'limit' ) ?: 40 ) );
		$atts = Attachments::for_messages( array_map( static fn( $m ) => (int) $m['id'], $page['items'] ) );
		$out  = array();
		foreach ( $page['items'] as $m ) {
			$out[] = array(
				'id'          => (string) $m['public_id'],
				'cursor'      => (int) $m['id'],
				'author'      => (string) $m['author_type'],
				'author_name' => (string) $m['author_name'],
				'source'      => (string) $m['source'],
				'body'        => (string) $m['body'],
				'delivery'    => (string) $m['delivery_state'],
				'delivery_error' => (string) $m['delivery_error'],
				'created_at'  => Clock::iso( (string) $m['created_at'] ),
				'attachments' => array_map( array( Serializer::class, 'attachment' ), $atts[ (int) $m['id'] ] ?? array() ),
			);
		}
		$fresh = Conversations::get( (int) $c['id'] ) ?? $c;
		return array(
			'items'          => $out,
			'has_more'       => $page['has_more'],
			'visitor_typing' => ( Clock::to_ts( $fresh['visitor_typing_until'] ) ?? 0 ) > Clock::now(),
			'visitor_read'   => (int) $fresh['visitor_read_id'],
			'status'         => (string) $fresh['status'],
		);
	}

	public function reply( \WP_REST_Request $r ) {
		$c    = $this->conversation( $r );
		$op   = $this->operator();
		$atts = array();
		foreach ( array_slice( (array) $r->get_param( 'attachments' ), 0, 5 ) as $pid ) {
			$a = Attachments::by_public_id( (string) $pid );
			if ( ! $a || (int) $a['conversation_id'] !== (int) $c['id'] || 'operator' !== $a['uploader_type'] || null !== $a['message_id'] ) {
				throw new DomainException( 'attachment_not_found', __( 'Attachment not found.', 'televixo' ), 404 );
			}
			$atts[] = (int) $a['id'];
		}
		if ( ! $c['assigned_operator_id'] ) {
			$c = Assignment::claim( $c, $op, 'reply' );
		}
		$mirror = Messages::relay_enabled( $c ) && rest_sanitize_boolean( $r->get_param( 'mirror' ) ?? true );
		$m      = Messages::create_operator_message( $c, $op, (string) $r->get_param( 'body' ), 'admin', $atts, $mirror );
		return new \WP_REST_Response( array( 'message' => array( 'id' => $m['public_id'], 'cursor' => (int) $m['id'] ) ), 201 );
	}

	public function upload( \WP_REST_Request $r ) {
		$c    = $this->conversation( $r );
		$op   = $this->operator();
		$file = $r->get_file_params()['file'] ?? null;
		if ( ! is_array( $file ) || UPLOAD_ERR_OK !== (int) ( $file['error'] ?? 4 ) ) {
			return self::error( 'file_missing', __( 'No file received.', 'televixo' ), 400 );
		}
		$att = Attachments::store( $c, (string) $file['tmp_name'], (string) $file['name'], 'operator', (int) $op['id'], ! ( defined( 'TELEVIXO_TESTING' ) && TELEVIXO_TESTING ) );
		return new \WP_REST_Response( array( 'attachment' => Serializer::attachment( $att ) ), 201 );
	}

	public function notes( \WP_REST_Request $r ) {
		$c = $this->conversation( $r );
		return array(
			'items' => array_map(
				static fn( $n ) => array( 'id' => (int) $n['id'], 'author_name' => (string) $n['author_name'], 'source' => (string) $n['source'], 'body' => (string) $n['body'], 'created_at' => Clock::iso( (string) $n['created_at'] ) ),
				array_reverse( Messages::notes( (int) $c['id'] ) )
			),
		);
	}

	public function add_note( \WP_REST_Request $r ) {
		$c = $this->conversation( $r );
		$n = Messages::create_note( $c, $this->operator(), (string) $r->get_param( 'body' ), 'admin' );
		return new \WP_REST_Response( array( 'id' => (int) $n['id'] ), 201 );
	}

	public function claim( \WP_REST_Request $r ) {
		$c = $this->conversation( $r );
		return array( 'conversation' => $this->conv_shape( Assignment::claim( $c, $this->operator() ) ) );
	}

	public function assign( \WP_REST_Request $r ) {
		$c  = $this->conversation( $r );
		$op = $this->operator();
		if ( ! Operators::can_view_all( $op ) && (int) $c['assigned_operator_id'] !== (int) $op['id'] ) {
			throw new DomainException( 'forbidden', __( 'Only the assignee or a supervisor can transfer.', 'televixo' ), 403 );
		}
		$to   = absint( $r->get_param( 'operator_id' ) );
		$team = $r->get_param( 'team_id' );
		if ( null !== $team ) {
			Db::update( 'conversations', array( 'team_id' => absint( $team ) ?: null, 'updated_at' => Clock::mysql() ), array( 'id' => (int) $c['id'] ) );
			Events::record( 'conversation.team', 'user', (string) get_current_user_id(), (int) $c['id'], 'team', (string) absint( $team ) );
			$c = Conversations::get( (int) $c['id'] ) ?? $c;
		}
		if ( $to ) {
			$c = Assignment::transfer( $c, $to, 'user', get_current_user_id() );
		}
		return array( 'conversation' => $this->conv_shape( Conversations::get( (int) $c['id'] ) ?? $c ) );
	}

	public function unassign( \WP_REST_Request $r ) {
		$c = $this->conversation( $r );
		return array( 'conversation' => $this->conv_shape( Assignment::unassign( $c, 'user', get_current_user_id() ) ) );
	}

	public function status( \WP_REST_Request $r ) {
		$c      = $this->conversation( $r );
		$status = self::str( $r, 'status', 16 );
		$uid    = (string) get_current_user_id();
		$c      = match ( $status ) {
			'closed'   => Conversations::close( $c, 'operator', $uid ),
			'spam'     => Conversations::mark_spam( $c, 'operator', $uid ),
			'reopened' => Conversations::transition( $c, ConversationStatus::Reopened, 'operator', $uid ),
			'queued'   => Conversations::transition( $c, ConversationStatus::Queued, 'operator', $uid ),
			default    => throw new DomainException( 'invalid_status', __( 'Invalid status.', 'televixo' ), 422 ),
		};
		if ( 'reopened' === $status && 'topics' === $c['routing_mode'] && '' !== $c['provider_thread_id'] ) {
			Outbox::enqueue( 'telegram.topic_state', 'conv:' . $c['id'], array( 'state' => 'open' ), (int) $c['id'] );
		}
		return array( 'conversation' => $this->conv_shape( $c ) );
	}

	public function meta( \WP_REST_Request $r ) {
		$c = $this->conversation( $r );
		if ( null !== $r->get_param( 'priority' ) ) {
			Db::update( 'conversations', array( 'priority' => max( 0, min( 3, (int) $r->get_param( 'priority' ) ) ) ), array( 'id' => (int) $c['id'] ) );
		}
		if ( is_array( $r->get_param( 'tags' ) ) ) {
			Db::exec( Db::prepare( 'DELETE FROM {conversation_tags} WHERE conversation_id = %d', (int) $c['id'] ) );
			foreach ( array_slice( $r->get_param( 'tags' ), 0, 10 ) as $name ) {
				$name = mb_substr( sanitize_text_field( (string) $name ), 0, 64 );
				$slug = sanitize_title( $name );
				if ( '' === $slug ) {
					continue;
				}
				Db::insert_ignore_duplicate( 'tags', array( 'name' => $name, 'slug' => $slug ) );
				$tag = (int) Db::var( Db::prepare( 'SELECT id FROM {tags} WHERE slug = %s', $slug ) );
				Db::insert_ignore_duplicate( 'conversation_tags', array( 'conversation_id' => (int) $c['id'], 'tag_id' => $tag ) );
			}
		}
		return array( 'tags' => $this->conv_tags( (int) $c['id'] ) );
	}

	public function typing( \WP_REST_Request $r ) {
		$c = $this->conversation( $r );
		Conversations::set_typing( (int) $c['id'], 'operator' );
		return array( 'ok' => true );
	}

	public function read( \WP_REST_Request $r ) {
		$c = $this->conversation( $r );
		Conversations::mark_read( (int) $c['id'], 'operator', min( absint( $r->get_param( 'cursor' ) ), (int) $c['last_message_id'] ) );
		return array( 'ok' => true );
	}

	public function delete( \WP_REST_Request $r ) {
		$c = $this->conversation( $r );
		Retention::delete_conversation( (int) $c['id'] );
		Events::record( 'conversation.deleted', 'user', (string) get_current_user_id(), null, 'conversation', (string) $c['reference'] );
		return array( 'deleted' => true );
	}

	public function export( \WP_REST_Request $r ) {
		$c = $this->conversation( $r );
		return \Televixo\Privacy\PersonalData::conversation_export( $c );
	}

	public function block( \WP_REST_Request $r ) {
		$v = Db::row( Db::prepare( 'SELECT * FROM {visitors} WHERE public_id = %s', (string) $r['vid'] ) );
		if ( ! $v ) {
			throw new DomainException( 'visitor_not_found', __( 'Visitor not found.', 'televixo' ), 404 );
		}
		// Operators may only block visitors from conversations they can access.
		$op  = $this->operator();
		$any = false;
		foreach ( Db::rows( Db::prepare( 'SELECT * FROM {conversations} WHERE visitor_id = %d ORDER BY id DESC LIMIT 20', (int) $v['id'] ) ) as $conv ) {
			if ( Operators::can_access( $op, $conv ) ) {
				$any = true;
				break;
			}
		}
		if ( ! $any ) {
			throw new DomainException( 'visitor_not_found', __( 'Visitor not found.', 'televixo' ), 404 );
		}
		Visitors::block( (int) $v['id'], self::str( $r, 'reason', 190 ), rest_sanitize_boolean( $r->get_param( 'network' ) ) && current_user_can( Caps::MANAGE_SETTINGS ), 'user', (string) get_current_user_id() );
		return array( 'blocked' => true );
	}

	public function unblock( \WP_REST_Request $r ) {
		$v = Db::row( Db::prepare( 'SELECT * FROM {visitors} WHERE public_id = %s', (string) $r['vid'] ) );
		if ( $v ) {
			Visitors::unblock( (int) $v['id'], 'user', (string) get_current_user_id() );
		}
		return array( 'blocked' => false );
	}

	public function tags() {
		return array( 'items' => Db::rows( Db::prepare( 'SELECT id, name, slug FROM {tags} ORDER BY name ASC LIMIT 500' ) ) );
	}

	public function canned() {
		return array( 'items' => Db::rows( Db::prepare( 'SELECT id, shortcut, title, body FROM {canned_replies} ORDER BY shortcut ASC LIMIT 500' ) ) );
	}

	public function save_canned( \WP_REST_Request $r ) {
		$shortcut = sanitize_key( self::str( $r, 'shortcut', 64 ) );
		$title    = sanitize_text_field( self::str( $r, 'title', 190 ) );
		$body     = mb_substr( sanitize_textarea_field( (string) $r->get_param( 'body' ) ), 0, 4000 );
		if ( '' === $shortcut || '' === $body ) {
			throw new DomainException( 'validation_failed', __( 'Shortcut and text are required.', 'televixo' ), 422 );
		}
		$id   = absint( $r->get_param( 'id' ) );
		$data = array( 'shortcut' => $shortcut, 'title' => $title ?: $shortcut, 'body' => $body, 'updated_at' => Clock::mysql() );
		if ( $id ) {
			Db::update( 'canned_replies', $data, array( 'id' => $id ) );
		} else {
			$data['created_at'] = Clock::mysql();
			$data['created_by'] = get_current_user_id();
			if ( ! Db::insert_ignore_duplicate( 'canned_replies', $data ) ) {
				throw new DomainException( 'duplicate', __( 'That shortcut already exists.', 'televixo' ), 409 );
			}
		}
		return $this->canned();
	}

	public function delete_canned( \WP_REST_Request $r ) {
		Db::exec( Db::prepare( 'DELETE FROM {canned_replies} WHERE id = %d', absint( $r['n'] ) ) );
		return $this->canned();
	}

	public function operators() {
		$loads = Assignment::open_loads( array_map( static fn( $o ) => (int) $o['id'], Operators::all() ) );
		return array(
			'items' => array_map(
				function ( $o ) use ( $loads ) {
					return $this->op_shape( $o ) + array( 'open' => $loads[ (int) $o['id'] ] ?? 0 );
				},
				Operators::all()
			),
			'candidates' => current_user_can( Caps::MANAGE_SETTINGS ) ? array_map(
				static fn( $u ) => array( 'id' => (int) $u->ID, 'name' => $u->display_name ),
				get_users( array( 'capability__in' => array( Caps::HANDLE_ASSIGNED, Caps::VIEW_ALL ), 'number' => 200, 'fields' => array( 'ID', 'display_name' ) ) )
			) : array(),
		);
	}

	public function add_operator( \WP_REST_Request $r ) {
		$uid = absint( $r->get_param( 'user_id' ) );
		if ( ! $uid || ! Caps::can_use_inbox( $uid ) ) {
			throw new DomainException( 'invalid_user', __( 'That user cannot handle chats. Give them the Chat Operator role first.', 'televixo' ), 422 );
		}
		Operators::for_user( $uid );
		return $this->operators();
	}

	public function update_operator( \WP_REST_Request $r ) {
		$id = absint( $r['n'] );
		$op = Operators::get( $id );
		if ( ! $op ) {
			throw new DomainException( 'operator_not_found', __( 'Operator not found.', 'televixo' ), 404 );
		}
		$data = array( 'updated_at' => Clock::mysql() );
		if ( null !== $r->get_param( 'status' ) ) {
			$data['status'] = 'disabled' === $r->get_param( 'status' ) ? 'disabled' : 'active';
		}
		if ( null !== $r->get_param( 'max_concurrent' ) ) {
			$data['max_concurrent'] = max( 1, min( 100, (int) $r->get_param( 'max_concurrent' ) ) );
		}
		if ( null !== $r->get_param( 'display_name' ) ) {
			$data['display_name'] = mb_substr( sanitize_text_field( (string) $r->get_param( 'display_name' ) ), 0, 190 );
		}
		Db::update( 'operators', $data, array( 'id' => $id ) );
		if ( is_array( $r->get_param( 'teams' ) ) ) {
			Db::exec( Db::prepare( 'DELETE FROM {team_members} WHERE operator_id = %d', $id ) );
			foreach ( array_map( 'absint', $r->get_param( 'teams' ) ) as $team ) {
				if ( $team ) {
					Db::insert_ignore_duplicate( 'team_members', array( 'team_id' => $team, 'operator_id' => $id ) );
				}
			}
		}
		Events::record( 'operator.updated', 'user', (string) get_current_user_id(), null, 'operator', (string) $id, $data );
		return $this->operators();
	}

	/**
	 * Operators can create codes for themselves; settings managers for anyone.
	 */
	public function challenge( \WP_REST_Request $r ) {
		$id = absint( $r['n'] );
		$me = $this->operator();
		if ( (int) $me['id'] !== $id && ! current_user_can( Caps::MANAGE_SETTINGS ) ) {
			throw new DomainException( 'forbidden', __( 'You can only link your own Telegram account.', 'televixo' ), 403 );
		}
		if ( ! Operators::get( $id ) ) {
			throw new DomainException( 'operator_not_found', __( 'Operator not found.', 'televixo' ), 404 );
		}
		$c = Operators::create_challenge( $id );
		return array( 'code' => $c['code'], 'expires_at' => $c['expires_at'], 'command' => '/link ' . $c['code'], 'bot_username' => (string) Settings::get( 'telegram.bot_username' ) );
	}

	public function unlink( \WP_REST_Request $r ) {
		$id = absint( $r['n'] );
		$me = $this->operator();
		if ( (int) $me['id'] !== $id && ! current_user_can( Caps::MANAGE_SETTINGS ) ) {
			throw new DomainException( 'forbidden', __( 'You can only unlink your own Telegram account.', 'televixo' ), 403 );
		}
		Operators::unlink_telegram( $id );
		return $this->operators();
	}

	public function teams() {
		$teams = Db::rows( Db::prepare( 'SELECT * FROM {teams} ORDER BY name ASC LIMIT 200' ) );
		foreach ( $teams as &$t ) {
			$t['members'] = array_map( 'intval', Db::wpdb()->get_col( Db::prepare( 'SELECT operator_id FROM {team_members} WHERE team_id = %d', (int) $t['id'] ) ) );
		}
		return array( 'items' => $teams );
	}

	public function save_team( \WP_REST_Request $r ) {
		$name = mb_substr( sanitize_text_field( self::str( $r, 'name', 190 ) ), 0, 190 );
		if ( '' === $name ) {
			throw new DomainException( 'validation_failed', __( 'Team name is required.', 'televixo' ), 422 );
		}
		$data = array(
			'name'                => $name,
			'slug'                => sanitize_title( self::str( $r, 'slug', 64 ) ?: $name ),
			'routing_strategy'    => in_array( $r->get_param( 'routing_strategy' ), array( 'manual', 'round_robin', 'load' ), true ) ? (string) $r->get_param( 'routing_strategy' ) : 'manual',
			'destination_chat_id' => Settings::provider_id( $r->get_param( 'destination_chat_id' ) ),
			'updated_at'          => Clock::mysql(),
		);
		$id = absint( $r->get_param( 'id' ) );
		if ( $id ) {
			Db::update( 'teams', $data, array( 'id' => $id ) );
		} else {
			$data['created_at'] = Clock::mysql();
			if ( ! Db::insert_ignore_duplicate( 'teams', $data ) ) {
				throw new DomainException( 'duplicate', __( 'A team with that slug exists.', 'televixo' ), 409 );
			}
		}
		return $this->teams();
	}

	public function delete_team( \WP_REST_Request $r ) {
		$id = absint( $r['n'] );
		Db::exec( Db::prepare( 'DELETE FROM {team_members} WHERE team_id = %d', $id ) );
		Db::exec( Db::prepare( 'UPDATE {conversations} SET team_id = NULL WHERE team_id = %d', $id ) );
		Db::exec( Db::prepare( 'DELETE FROM {teams} WHERE id = %d', $id ) );
		return $this->teams();
	}

	public function kb() {
		return array( 'items' => KnowledgeBase::all() );
	}

	public function save_kb( \WP_REST_Request $r ) {
		KnowledgeBase::save( (array) $r->get_json_params(), absint( $r->get_param( 'id' ) ) );
		return $this->kb();
	}

	public function delete_kb( \WP_REST_Request $r ) {
		KnowledgeBase::delete( absint( $r['n'] ) );
		return $this->kb();
	}

	public function rules() {
		return array( 'items' => Rules::all() );
	}

	public function save_rule( \WP_REST_Request $r ) {
		$rule = Rules::save( (array) $r->get_json_params(), absint( $r->get_param( 'id' ) ) );
		Events::record( 'rule.saved', 'user', (string) get_current_user_id(), null, 'rule', (string) $rule['id'] );
		return array( 'rule' => $rule );
	}

	public function delete_rule( \WP_REST_Request $r ) {
		Rules::delete( absint( $r['n'] ) );
		return array( 'deleted' => true );
	}

	/**
	 * "Why this rule matched": evaluates rules against a simulated context.
	 */
	public function preview_rules( \WP_REST_Request $r ) {
		$ctx   = (array) $r->get_param( 'context' );
		$rules = array();
		if ( is_array( $r->get_param( 'definition' ) ) ) {
			$v = RuleSchema::validate( $r->get_param( 'definition' ) );
			if ( ! $v['ok'] ) {
				return new \WP_Error( 'rule_invalid', implode( '; ', $v['errors'] ), array( 'status' => 422, 'errors' => $v['errors'] ) );
			}
			$rules[] = array( 'id' => absint( $r->get_param( 'id' ) ), 'priority' => (int) $r->get_param( 'priority' ), 'definition' => $v['definition'] );
		} else {
			foreach ( Rules::all() as $rule ) {
				if ( 'enabled' === $rule['status'] ) {
					$rules[] = $rule;
				}
			}
		}
		$ctx['now'] = $ctx['now'] ?? Clock::now();
		return Engine::resolve( $rules, $ctx );
	}

	public function export_rules() {
		return Rules::export();
	}

	public function import_rules( \WP_REST_Request $r ) {
		return Rules::import( (array) $r->get_param( 'data' ), rest_sanitize_boolean( $r->get_param( 'enable' ) ) );
	}

	public function rule_schema() {
		return array( 'conditions' => RuleSchema::CONDITIONS, 'actions' => RuleSchema::ACTIONS );
	}

	public function settings() {
		return array(
			'settings' => Settings::all(),
			'secrets'  => array(
				'bot_token_set'         => \Televixo\Security\Secrets::bot_token() !== '',
				'bot_token_from_config' => \Televixo\Security\Secrets::bot_token_from_config(),
				'key_source'            => \Televixo\Security\Secrets::key_source(),
			),
			'roles'    => array_map( static fn( $r ) => translate_user_role( $r['name'] ), wp_roles()->roles ),
			'woocommerce' => class_exists( 'WooCommerce' ),
		);
	}

	public function save_settings( \WP_REST_Request $r ) {
		$in = (array) $r->get_param( 'settings' );
		// Telegram identity and destination are only changed via the setup flow.
		unset( $in['telegram']['bot_id'], $in['telegram']['bot_username'], $in['telegram']['destination_chat_id'], $in['telegram']['webhook_url'], $in['telegram']['webhook_owner'] );
		$before = Settings::get( 'telegram.routing_mode' );
		$saved  = Settings::update( $in );
		if ( $before !== $saved['telegram']['routing_mode'] ) {
			// Existing conversations keep their snapshot; only new ones change.
			Events::record( 'settings.routing_mode', 'user', (string) get_current_user_id(), null, '', '', array( 'from' => $before, 'to' => $saved['telegram']['routing_mode'] ) );
		}
		Events::record( 'settings.saved', 'user', (string) get_current_user_id() );
		return $this->settings();
	}

	/**
	 * Settings export excludes secrets (bot token, webhook secret) and
	 * environment-bound identity by default.
	 */
	public function export_settings() {
		$s = Settings::all();
		unset( $s['telegram']['webhook_url'], $s['telegram']['webhook_owner'] );
		return array(
			'format'   => 'televixo-settings',
			'version'  => 1,
			'exported' => gmdate( 'c' ),
			'settings' => $s,
			'rules'    => Rules::export()['rules'],
			'secrets'  => 'excluded',
		);
	}

	public function import_settings( \WP_REST_Request $r ) {
		$data = (array) $r->get_param( 'data' );
		if ( 'televixo-settings' !== ( $data['format'] ?? '' ) ) {
			throw new DomainException( 'import_invalid', __( 'This is not a Televixo settings export.', 'televixo' ), 422 );
		}
		$in = (array) ( $data['settings'] ?? array() );
		unset( $in['telegram']['bot_id'], $in['telegram']['bot_username'], $in['telegram']['webhook_url'], $in['telegram']['webhook_owner'] );
		Settings::update( $in );
		$rules = array( 'imported' => 0, 'errors' => array() );
		if ( rest_sanitize_boolean( $r->get_param( 'include_rules' ) ) && ! empty( $data['rules'] ) ) {
			$rules = Rules::import( array( 'format' => 'televixo-rules', 'rules' => $data['rules'] ) );
		}
		Events::record( 'settings.imported', 'user', (string) get_current_user_id() );
		return array( 'ok' => true, 'rules' => $rules );
	}

	public function reports( \WP_REST_Request $r ) {
		$from = self::str( $r, 'from', 10 );
		$to   = self::str( $r, 'to', 10 );
		return Reports::summary( $from, $to );
	}

	public function queue( \WP_REST_Request $r ) {
		$status = self::str( $r, 'status', 16 ) ?: 'dead';
		$rows   = Db::rows( Db::prepare( 'SELECT id, job_type, conversation_id, message_id, status, attempts, max_attempts, available_at, last_error_code, last_error, created_at, updated_at FROM {outbox} WHERE status = %s ORDER BY id DESC LIMIT 100', $status ) );
		foreach ( $rows as &$row ) {
			$conv               = $row['conversation_id'] ? Conversations::get( (int) $row['conversation_id'] ) : null;
			$row['reference']   = $conv['reference'] ?? '';
			$row['conversation'] = $conv['public_id'] ?? '';
		}
		return array( 'items' => $rows, 'health' => \Televixo\Queue\Scheduler::health() );
	}

	public function queue_retry( \WP_REST_Request $r ) {
		$id  = absint( $r['n'] );
		$job = Outbox::get( $id );
		$ok  = Outbox::manual_retry( $id );
		if ( $ok && $job && $job['message_id'] ) {
			Messages::set_delivery( (int) $job['message_id'], \Televixo\Domain\DeliveryState::Queued );
		}
		Events::record( 'queue.retry', 'user', (string) get_current_user_id(), $job ? (int) $job['conversation_id'] : null, 'job', (string) $id );
		return array( 'ok' => $ok );
	}

	public function queue_discard( \WP_REST_Request $r ) {
		$id = absint( $r['n'] );
		$ok = Outbox::discard( $id );
		Events::record( 'queue.discard', 'user', (string) get_current_user_id(), null, 'job', (string) $id );
		return array( 'ok' => $ok );
	}

	public function queue_run() {
		return Worker::run( 10.0 );
	}

	public function run_retention() {
		return Retention::run();
	}

	private function conv_tags( int $id ): array {
		return Db::wpdb()->get_col( Db::prepare( 'SELECT t.name FROM {tags} t JOIN {conversation_tags} ct ON ct.tag_id = t.id WHERE ct.conversation_id = %d ORDER BY t.name', $id ) );
	}

	/**
	 * @return array<string,mixed>
	 */
	private function conv_shape( array $c ): array {
		$op = $c['assigned_operator_id'] ? Operators::get( (int) $c['assigned_operator_id'] ) : null;
		return array(
			'id'               => (string) $c['public_id'],
			'reference'        => (string) $c['reference'],
			'status'           => (string) $c['status'],
			'offline'          => (bool) $c['is_offline'],
			'priority'         => (int) $c['priority'],
			'department'       => (string) $c['department'],
			'team_id'          => $c['team_id'] ? (int) $c['team_id'] : null,
			'routing_mode'     => (string) $c['routing_mode'],
			'assigned'         => $op ? array( 'id' => (int) $op['id'], 'name' => (string) $op['display_name'] ) : null,
			'visitor'          => array(
				'id'      => (string) ( $c['visitor_public_id'] ?? '' ),
				'name'    => (string) ( $c['visitor_name'] ?? '' ),
				'email'   => (string) ( $c['visitor_email'] ?? '' ),
				'blocked' => (bool) ( $c['is_blocked'] ?? false ),
			),
			'unread'           => (int) ( $c['unread'] ?? 0 ),
			'last_body'        => mb_substr( (string) ( $c['last_body'] ?? '' ), 0, 140 ),
			'last_message_at'  => Clock::iso( $c['last_message_at'] ?? null ),
			'created_at'       => Clock::iso( (string) $c['created_at'] ),
			'closed_at'        => Clock::iso( $c['closed_at'] ?? null ),
			'human_engaged'    => (bool) $c['human_engaged'],
		);
	}

	/**
	 * @return array<string,mixed>
	 */
	private function op_shape( array $o ): array {
		return array(
			'id'                => (int) $o['id'],
			'user_id'           => (int) $o['wp_user_id'],
			'name'              => (string) $o['display_name'],
			'status'            => (string) $o['status'],
			'availability'      => (string) $o['availability'],
			'present'           => Operators::is_present( $o ),
			'telegram_linked'   => ! empty( $o['telegram_user_id'] ),
			'telegram_username' => (string) $o['telegram_username'],
			'max_concurrent'    => (int) $o['max_concurrent'],
			'teams'             => Operators::team_ids( (int) $o['id'] ),
		);
	}
}
