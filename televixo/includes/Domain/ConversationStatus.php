<?php
/**
 * Conversation states and the allowed transitions between them.
 *
 *   pending  – created, no visitor message yet
 *   queued   – visitor wrote, nobody assigned
 *   assigned – an operator claimed or was assigned, no human reply yet
 *   open     – human engaged and the visitor is waiting for the next reply
 *   waiting  – an operator replied last; waiting for the visitor
 *   closed   – ended by visitor, operator or retention policy
 *   reopened – the visitor wrote again after closure
 *   spam     – marked as abuse; messages are kept but not relayed
 *
 * @package Televixo
 */

namespace Televixo\Domain;

defined( 'ABSPATH' ) || exit;

enum ConversationStatus: string {
	case Pending  = 'pending';
	case Queued   = 'queued';
	case Assigned = 'assigned';
	case Open     = 'open';
	case Waiting  = 'waiting';
	case Closed   = 'closed';
	case Reopened = 'reopened';
	case Spam     = 'spam';

	/**
	 * @return ConversationStatus[]
	 */
	public function allowed_next(): array {
		return match ( $this ) {
			self::Pending  => array( self::Queued, self::Assigned, self::Waiting, self::Closed, self::Spam ),
			self::Queued   => array( self::Assigned, self::Waiting, self::Closed, self::Spam ),
			self::Assigned => array( self::Assigned, self::Queued, self::Open, self::Waiting, self::Closed, self::Spam ),
			self::Open     => array( self::Assigned, self::Queued, self::Waiting, self::Closed, self::Spam ),
			self::Waiting  => array( self::Assigned, self::Queued, self::Open, self::Closed, self::Spam ),
			self::Closed   => array( self::Reopened, self::Spam ),
			self::Reopened => array( self::Assigned, self::Queued, self::Open, self::Waiting, self::Closed, self::Spam ),
			self::Spam     => array( self::Queued, self::Closed ),
		};
	}

	public function can_transition_to( self $next ): bool {
		return in_array( $next, $this->allowed_next(), true );
	}

	public function is_active(): bool {
		return ! in_array( $this, array( self::Closed, self::Spam ), true );
	}

	/**
	 * State after a visitor message.
	 */
	public function after_visitor_message(): self {
		return match ( $this ) {
			self::Pending  => self::Queued,
			self::Waiting  => self::Open,
			self::Closed   => self::Reopened,
			default        => $this,
		};
	}

	/**
	 * State after a public human operator reply.
	 */
	public function after_operator_reply(): self {
		return match ( $this ) {
			self::Spam, self::Closed => $this,
			default                  => self::Waiting,
		};
	}
}
