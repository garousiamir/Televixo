<?php
/**
 * Atomic claim, assignment and transfer. Every write is a conditional UPDATE
 * on the value the caller expects, so two operators claiming at the same time
 * produce exactly one winner and one `already_claimed` conflict.
 *
 * @package Televixo
 */

namespace Televixo\Domain;

use Televixo\Core\Clock;
use Televixo\Core\Settings;
use Televixo\Persistence\Db;

defined( 'ABSPATH' ) || exit;

final class Assignment {

	/**
	 * @return array<string,mixed> Updated conversation.
	 * @throws DomainException On conflict.
	 */
	public static function claim( array $conversation, array $operator, string $reason = 'claim' ): array {
		return self::assign_conditional( $conversation, (int) $operator['id'], null, $reason, 'operator', (int) $operator['id'] );
	}

	/**
	 * Transfer from the current assignee (or unassigned) to another operator.
	 *
	 * @throws DomainException On conflict.
	 */
	public static function transfer( array $conversation, int $to_operator_id, string $actor_type, int $actor_ref ): array {
		$to = Operators::get( $to_operator_id );
		if ( ! $to || 'active' !== $to['status'] ) {
			throw new DomainException( 'operator_not_found', __( 'Operator not found.', 'televixo' ), 404 );
		}
		$expected = $conversation['assigned_operator_id'] ? (int) $conversation['assigned_operator_id'] : 0;
		return self::assign_conditional( $conversation, $to_operator_id, $expected, 'transfer', $actor_type, $actor_ref );
	}

	public static function unassign( array $conversation, string $actor_type, int $actor_ref ): array {
		$expected = (int) $conversation['assigned_operator_id'];
		if ( ! $expected ) {
			return $conversation;
		}
		$n = Db::exec(
			Db::prepare(
				"UPDATE {conversations} SET assigned_operator_id = NULL, status = IF(status = 'assigned', 'queued', status), updated_at = %s WHERE id = %d AND assigned_operator_id = %d",
				Clock::mysql(),
				(int) $conversation['id'],
				$expected
			)
		);
		if ( 1 !== $n ) {
			throw new DomainException( 'conflict', __( 'The assignment changed. Reload and try again.', 'televixo' ), 409 );
		}
		self::close_open_assignment( (int) $conversation['id'] );
		Events::record( 'conversation.unassigned', $actor_type, (string) $actor_ref, (int) $conversation['id'] );
		return Conversations::get( (int) $conversation['id'] ) ?? $conversation;
	}

	/**
	 * @param int|null $expected null = must be unassigned; 0 = unassigned; >0 = that operator.
	 */
	private static function assign_conditional( array $conversation, int $operator_id, ?int $expected, string $reason, string $actor_type, int $actor_ref ): array {
		if ( ! ConversationStatus::from( (string) $conversation['status'] )->is_active() ) {
			throw new DomainException( 'conversation_closed', __( 'This conversation is closed.', 'televixo' ), 409 );
		}
		$now   = Clock::mysql();
		$where = ( null === $expected || 0 === $expected )
			? 'assigned_operator_id IS NULL'
			: Db::prepare( 'assigned_operator_id = %d', $expected );
		$n = Db::exec(
			Db::prepare(
				"UPDATE {conversations}
				SET assigned_operator_id = %d,
					status = IF(status IN ('pending','queued','reopened'), 'assigned', status),
					assigned_at = %s, updated_at = %s
				WHERE id = %d AND status NOT IN ('closed','spam') AND $where",
				$operator_id,
				$now,
				$now,
				(int) $conversation['id']
			)
		);
		$fresh = Conversations::get( (int) $conversation['id'] ) ?? $conversation;
		if ( 1 !== $n ) {
			if ( (int) $fresh['assigned_operator_id'] === $operator_id ) {
				return $fresh; // Idempotent repeat.
			}
			throw new DomainException( 'already_claimed', __( 'Another operator already took this conversation.', 'televixo' ), 409 );
		}
		Db::transaction(
			static function () use ( $fresh, $operator_id, $reason, $actor_type, $actor_ref, $now ): void {
				self::close_open_assignment( (int) $fresh['id'] );
				Db::insert(
					'assignments',
					array(
						'conversation_id' => (int) $fresh['id'],
						'operator_id'     => $operator_id,
						'team_id'         => $fresh['team_id'] ? (int) $fresh['team_id'] : null,
						'reason'          => $reason,
						'actor_type'      => $actor_type,
						'actor_ref'       => $actor_ref,
						'started_at'      => $now,
					)
				);
				Db::update( 'operators', array( 'last_assigned_at' => $now ), array( 'id' => $operator_id ) );
			}
		);
		Events::record( 'conversation.assigned', $actor_type, (string) $actor_ref, (int) $fresh['id'], 'operator', (string) $operator_id, array( 'reason' => $reason ) );
		do_action( 'televixo_conversation_assigned', (int) $fresh['id'], $operator_id, $reason );
		return $fresh;
	}

	private static function close_open_assignment( int $conversation_id ): void {
		Db::exec( Db::prepare( 'UPDATE {assignments} SET ended_at = %s WHERE conversation_id = %d AND ended_at IS NULL', Clock::mysql(), $conversation_id ) );
	}

	/**
	 * Automatic routing for new or reopened conversations according to the
	 * team's (or global) strategy. Only present operators are considered.
	 */
	public static function auto_assign( int $conversation_id ): ?int {
		$conversation = Conversations::get( $conversation_id );
		if ( ! $conversation || $conversation['assigned_operator_id'] ) {
			return null;
		}
		$team_id  = (int) $conversation['team_id'];
		$strategy = (string) Settings::get( 'routing.strategy', 'manual' );
		if ( $team_id ) {
			$team_strategy = (string) Db::var( Db::prepare( 'SELECT routing_strategy FROM {teams} WHERE id = %d', $team_id ) );
			if ( '' !== $team_strategy ) {
				$strategy = $team_strategy;
			}
		}
		if ( 'manual' === $strategy ) {
			return null;
		}
		$candidates = Operators::present( $team_id ?: null );
		if ( ! $candidates ) {
			return null;
		}
		$loads = self::open_loads( array_map( static fn( $o ) => (int) $o['id'], $candidates ) );
		$candidates = array_values(
			array_filter( $candidates, static fn( $o ) => ( $loads[ (int) $o['id'] ] ?? 0 ) < max( 1, (int) $o['max_concurrent'] ) )
		);
		if ( ! $candidates ) {
			return null;
		}
		usort(
			$candidates,
			static function ( $a, $b ) use ( $strategy, $loads ): int {
				if ( 'load' === $strategy ) {
					$cmp = ( $loads[ (int) $a['id'] ] ?? 0 ) <=> ( $loads[ (int) $b['id'] ] ?? 0 );
					if ( 0 !== $cmp ) {
						return $cmp;
					}
				}
				// Round robin: least recently assigned first; ties by ID for determinism.
				$cmp = strcmp( (string) $a['last_assigned_at'], (string) $b['last_assigned_at'] );
				return 0 !== $cmp ? $cmp : ( (int) $a['id'] <=> (int) $b['id'] );
			}
		);
		foreach ( $candidates as $op ) {
			try {
				self::assign_conditional( $conversation, (int) $op['id'], null, 'load' === $strategy ? 'auto_load' : 'auto_rr', 'system', 0 );
				return (int) $op['id'];
			} catch ( DomainException $e ) {
				if ( 'already_claimed' === $e->error_code ) {
					return null;
				}
			}
		}
		return null;
	}

	/**
	 * @param int[] $operator_ids
	 * @return array<int,int>
	 */
	public static function open_loads( array $operator_ids ): array {
		if ( ! $operator_ids ) {
			return array();
		}
		$rows = Db::rows(
			Db::prepare(
				"SELECT assigned_operator_id AS op, COUNT(*) AS n FROM {conversations} WHERE status NOT IN ('closed','spam') AND assigned_operator_id IN (" . Db::in_ints( $operator_ids ) . ') GROUP BY assigned_operator_id'
			)
		);
		$out = array();
		foreach ( $rows as $r ) {
			$out[ (int) $r['op'] ] = (int) $r['n'];
		}
		return $out;
	}
}
