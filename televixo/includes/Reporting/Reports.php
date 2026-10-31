<?php
/**
 * Reporting. Definitions (docs/reports.md):
 *
 * - Range: inclusive local dates in the site time zone, converted to UTC
 *   boundaries; DST transitions are handled by PHP's tz database.
 * - Conversations: created in range, excluding spam.
 * - Unanswered: created in range, has a visitor message, and no human
 *   operator reply yet. Automated messages never count as answers.
 * - First response (human): first human operator reply minus the first
 *   visitor message. Median and mean in seconds.
 * - Resolution: closed_at minus created_at for conversations whose latest
 *   close falls in range. A reopened and re-closed conversation counts once,
 *   with its latest close; `reopened` reports how many were reopened.
 * - Queue wait: first assignment minus first queue entry.
 * - CSAT: mean score (1–5) and share of 4–5 ratings submitted in range.
 * - Operator performance: assignments started, public replies sent, median
 *   first response where the operator answered first, CSAT on conversations
 *   assigned to them at rating time.
 * - Automation conversion: per rule, visitors shown an attention action
 *   who started a conversation within 30 minutes.
 *
 * @package Televixo
 */

namespace Televixo\Reporting;

use Televixo\Persistence\Db;

defined( 'ABSPATH' ) || exit;

final class Reports {

	public const MAX_DAYS = 366;

	/**
	 * @return array<string,mixed>
	 */
	public static function summary( string $from = '', string $to = '' ): array {
		$tz    = wp_timezone();
		$today = new \DateTimeImmutable( 'now', $tz );
		$end   = preg_match( '/^\d{4}-\d{2}-\d{2}$/', $to ) ? new \DateTimeImmutable( $to, $tz ) : $today;
		$start = preg_match( '/^\d{4}-\d{2}-\d{2}$/', $from ) ? new \DateTimeImmutable( $from, $tz ) : $end->modify( '-29 days' );
		if ( $start > $end ) {
			[ $start, $end ] = array( $end, $start );
		}
		if ( $end->diff( $start )->days > self::MAX_DAYS ) {
			$start = $end->modify( '-' . self::MAX_DAYS . ' days' );
		}
		$utc_from = $start->setTime( 0, 0 )->setTimezone( new \DateTimeZone( 'UTC' ) )->format( 'Y-m-d H:i:s' );
		$utc_to   = $end->modify( '+1 day' )->setTime( 0, 0 )->setTimezone( new \DateTimeZone( 'UTC' ) )->format( 'Y-m-d H:i:s' );

		$created = Db::rows( Db::prepare( "SELECT id, status, created_at, first_human_response_at, last_visitor_message_at, reopened_count FROM {conversations} WHERE created_at >= %s AND created_at < %s AND status <> 'spam' LIMIT 100000", $utc_from, $utc_to ) );
		$ids     = array_map( static fn( $r ) => (int) $r['id'], $created );

		$first_visitor = array();
		if ( $ids ) {
			foreach ( array_chunk( $ids, 1000 ) as $chunk ) {
				foreach ( Db::rows( Db::prepare( "SELECT conversation_id, MIN(created_at) AS first_at FROM {messages} WHERE author_type = 'visitor' AND conversation_id IN (" . Db::in_ints( $chunk ) . ') GROUP BY conversation_id' ) ) as $r ) {
					$first_visitor[ (int) $r['conversation_id'] ] = (string) $r['first_at'];
				}
			}
		}
		$frt        = array();
		$unanswered = 0;
		$daily      = array();
		foreach ( $created as $c ) {
			$day           = ( new \DateTimeImmutable( $c['created_at'], new \DateTimeZone( 'UTC' ) ) )->setTimezone( $tz )->format( 'Y-m-d' );
			$daily[ $day ] = ( $daily[ $day ] ?? 0 ) + 1;
			$fv            = $first_visitor[ (int) $c['id'] ] ?? null;
			if ( $fv && empty( $c['first_human_response_at'] ) ) {
				++$unanswered;
			} elseif ( $fv && $c['first_human_response_at'] ) {
				$frt[] = max( 0, strtotime( $c['first_human_response_at'] . ' UTC' ) - strtotime( $fv . ' UTC' ) );
			}
		}
		$series = array();
		for ( $d = $start; $d <= $end; $d = $d->modify( '+1 day' ) ) {
			$k        = $d->format( 'Y-m-d' );
			$series[] = array(
				'date'          => $k,
				'conversations' => $daily[ $k ] ?? 0,
			);
		}

		$resolved = Db::rows( Db::prepare( "SELECT created_at, closed_at, reopened_count FROM {conversations} WHERE status = 'closed' AND closed_at >= %s AND closed_at < %s LIMIT 100000", $utc_from, $utc_to ) );
		$res      = array_map( static fn( $r ) => max( 0, strtotime( $r['closed_at'] . ' UTC' ) - strtotime( $r['created_at'] . ' UTC' ) ), $resolved );

		$waits = array_map(
			static fn( $r ) => max( 0, (int) $r['wait'] ),
			Db::rows(
				Db::prepare(
					'SELECT TIMESTAMPDIFF(SECOND, c.queued_at, MIN(a.started_at)) AS wait FROM {conversations} c JOIN {assignments} a ON a.conversation_id = c.id
					WHERE c.queued_at >= %s AND c.queued_at < %s AND a.started_at >= c.queued_at GROUP BY c.id LIMIT 100000',
					$utc_from,
					$utc_to
				)
			)
		);

		$ratings = Db::row( Db::prepare( 'SELECT COUNT(*) AS n, AVG(score) AS avg_score, SUM(score >= 4) AS good FROM {ratings} WHERE created_at >= %s AND created_at < %s', $utc_from, $utc_to ) );

		return array(
			'range'          => array(
				'from'     => $start->format( 'Y-m-d' ),
				'to'       => $end->format( 'Y-m-d' ),
				'timezone' => $tz->getName(),
			),
			'conversations'  => count( $created ),
			'unanswered'     => $unanswered,
			'reopened'       => count( array_filter( $created, static fn( $c ) => (int) $c['reopened_count'] > 0 ) ),
			'first_response' => self::stats( $frt ),
			'resolution'     => self::stats( $res ),
			'queue_wait'     => self::stats( $waits ),
			'csat'           => array(
				'responses'       => (int) ( $ratings['n'] ?? 0 ),
				'average'         => $ratings && $ratings['n'] ? round( (float) $ratings['avg_score'], 2 ) : null,
				'satisfied_share' => $ratings && $ratings['n'] ? round( (int) $ratings['good'] / (int) $ratings['n'], 3 ) : null,
			),
			'series'         => $series,
			'operators'      => self::operators( $utc_from, $utc_to ),
			'teams'          => Db::rows( Db::prepare( "SELECT COALESCE(t.name, '') AS team, COUNT(*) AS conversations FROM {conversations} c LEFT JOIN {teams} t ON t.id = c.team_id WHERE c.created_at >= %s AND c.created_at < %s AND c.status <> 'spam' GROUP BY c.team_id, t.name ORDER BY conversations DESC LIMIT 50", $utc_from, $utc_to ) ),
			'automation'     => self::automation( $utc_from, $utc_to ),
		);
	}

	/**
	 * @param int[] $values
	 * @return array{count:int,median:?int,mean:?int}
	 */
	public static function stats( array $values ): array {
		$n = count( $values );
		if ( 0 === $n ) {
			return array(
				'count'  => 0,
				'median' => null,
				'mean'   => null,
			);
		}
		sort( $values );
		$mid    = intdiv( $n, 2 );
		$median = $n % 2 ? $values[ $mid ] : intdiv( $values[ $mid - 1 ] + $values[ $mid ], 2 );
		return array(
			'count'  => $n,
			'median' => (int) $median,
			'mean'   => (int) round( array_sum( $values ) / $n ),
		);
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	private static function operators( string $from, string $to ): array {
		$rows = Db::rows(
			Db::prepare(
				"SELECT o.id, o.display_name,
					(SELECT COUNT(*) FROM {assignments} a WHERE a.operator_id = o.id AND a.started_at >= %s AND a.started_at < %s) AS assignments,
					(SELECT COUNT(*) FROM {messages} m WHERE m.author_type = 'operator' AND m.author_ref = o.id AND m.created_at >= %s AND m.created_at < %s) AS replies,
					(SELECT AVG(r.score) FROM {ratings} r JOIN {conversations} c ON c.id = r.conversation_id WHERE c.assigned_operator_id = o.id AND r.created_at >= %s AND r.created_at < %s) AS csat
				FROM {operators} o ORDER BY o.display_name ASC LIMIT 200",
				$from,
				$to,
				$from,
				$to,
				$from,
				$to
			)
		);
		$frt  = array();
		foreach ( Db::rows(
			Db::prepare(
				"SELECT c.id, c.first_human_response_at,
					(SELECT MIN(mv.created_at) FROM {messages} mv WHERE mv.conversation_id = c.id AND mv.author_type = 'visitor') AS first_visitor,
					(SELECT mo.author_ref FROM {messages} mo WHERE mo.conversation_id = c.id AND mo.author_type = 'operator' ORDER BY mo.id ASC LIMIT 1) AS responder
				FROM {conversations} c WHERE c.first_human_response_at >= %s AND c.first_human_response_at < %s LIMIT 50000",
				$from,
				$to
			)
		) as $r ) {
			if ( $r['first_visitor'] && $r['responder'] ) {
				$frt[ (int) $r['responder'] ][] = max( 0, strtotime( $r['first_human_response_at'] . ' UTC' ) - strtotime( $r['first_visitor'] . ' UTC' ) );
			}
		}
		return array_map(
			static fn( $r ) => array(
				'operator'       => (string) $r['display_name'],
				'assignments'    => (int) $r['assignments'],
				'replies'        => (int) $r['replies'],
				'first_response' => self::stats( $frt[ (int) $r['id'] ] ?? array() ),
				'csat'           => null !== $r['csat'] ? round( (float) $r['csat'], 2 ) : null,
			),
			$rows
		);
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	private static function automation( string $from, string $to ): array {
		return array_map(
			static fn( $r ) => array(
				'rule_id'     => (int) $r['rule_id'],
				'name'        => (string) $r['name'],
				'shown'       => (int) $r['shown'],
				'conversions' => (int) $r['conversions'],
				'rate'        => $r['shown'] ? round( (int) $r['conversions'] / (int) $r['shown'], 3 ) : 0,
			),
			Db::rows(
				Db::prepare(
					"SELECT t.rule_id, COALESCE(ru.name, '') AS name, COUNT(DISTINCT t.visitor_id) AS shown,
						COUNT(DISTINCT CASE WHEN EXISTS (
							SELECT 1 FROM {conversations} c WHERE c.visitor_id = t.visitor_id AND c.created_at >= t.created_at AND c.created_at < DATE_ADD(t.created_at, INTERVAL 30 MINUTE)
						) THEN t.visitor_id END) AS conversions
					FROM {trigger_executions} t LEFT JOIN {rules} ru ON ru.id = t.rule_id
					WHERE t.outcome = 'shown' AND t.created_at >= %s AND t.created_at < %s
					GROUP BY t.rule_id, ru.name ORDER BY shown DESC LIMIT 100",
					$from,
					$to
				)
			)
		);
	}
}
