<?php
/**
 * Operators: WordPress users who handle chats, optionally linked to a
 * Telegram account through a one-time enrollment challenge.
 *
 * @package Televixo
 */

namespace Televixo\Domain;

use Televixo\Core\Clock;
use Televixo\Persistence\Db;
use Televixo\Security\Capabilities;
use Televixo\Security\Random;
use Televixo\Security\Secrets;

defined( 'ABSPATH' ) || exit;

final class Operators {

	public const CHALLENGE_TTL      = 10 * MINUTE_IN_SECONDS;
	public const HEARTBEAT_TIMEOUT  = 90;

	/**
	 * @return array<string,mixed>|null
	 */
	public static function get( int $id ): ?array {
		return Db::row( Db::prepare( 'SELECT * FROM {operators} WHERE id = %d', $id ) );
	}

	/**
	 * Operator for a WordPress user, created on first use if the user may
	 * handle chats.
	 *
	 * @return array<string,mixed>|null
	 */
	public static function for_user( int $user_id, bool $create = true ): ?array {
		$row = Db::row( Db::prepare( 'SELECT * FROM {operators} WHERE wp_user_id = %d', $user_id ) );
		if ( $row || ! $create || ! Capabilities::can_use_inbox( $user_id ) ) {
			return $row;
		}
		$user = get_userdata( $user_id );
		if ( ! $user ) {
			return null;
		}
		$now = Clock::mysql();
		Db::insert_ignore_duplicate(
			'operators',
			array(
				'wp_user_id'   => $user_id,
				'display_name' => mb_substr( $user->display_name, 0, 190 ),
				'status'       => 'active',
				'created_at'   => $now,
				'updated_at'   => $now,
			)
		);
		return Db::row( Db::prepare( 'SELECT * FROM {operators} WHERE wp_user_id = %d', $user_id ) );
	}

	/**
	 * Active, enrolled operator for a Telegram user ID whose WordPress account
	 * still has an inbox capability.
	 *
	 * @return array<string,mixed>|null
	 */
	public static function by_telegram( string $telegram_user_id ): ?array {
		if ( '' === $telegram_user_id ) {
			return null;
		}
		$row = Db::row( Db::prepare( "SELECT * FROM {operators} WHERE telegram_user_id = %s AND status = 'active'", $telegram_user_id ) );
		if ( ! $row || ! Capabilities::can_use_inbox( (int) $row['wp_user_id'] ) ) {
			return null;
		}
		return $row;
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function all(): array {
		return Db::rows( Db::prepare( 'SELECT * FROM {operators} ORDER BY display_name ASC LIMIT 500' ) );
	}

	public static function can_view_all( array $operator ): bool {
		return user_can( (int) $operator['wp_user_id'], Capabilities::VIEW_ALL );
	}

	/**
	 * Conversation-level authorization shared by REST and Telegram paths.
	 * Operators with "view all" can act on any conversation. Others can act
	 * on conversations assigned to them, or unassigned conversations in their
	 * teams (or with no team).
	 */
	public static function can_access( array $operator, array $conversation ): bool {
		if ( 'active' !== $operator['status'] ) {
			return false;
		}
		if ( self::can_view_all( $operator ) ) {
			return true;
		}
		if ( ! user_can( (int) $operator['wp_user_id'], Capabilities::HANDLE_ASSIGNED ) ) {
			return false;
		}
		$assigned = (int) ( $conversation['assigned_operator_id'] ?? 0 );
		if ( $assigned ) {
			return $assigned === (int) $operator['id'];
		}
		$team = (int) ( $conversation['team_id'] ?? 0 );
		return 0 === $team || in_array( $team, self::team_ids( (int) $operator['id'] ), true );
	}

	/**
	 * @return int[]
	 */
	public static function team_ids( int $operator_id ): array {
		return array_map( 'intval', Db::wpdb()->get_col( Db::prepare( 'SELECT team_id FROM {team_members} WHERE operator_id = %d', $operator_id ) ) );
	}

	/**
	 * Creates a one-time enrollment code. Only the hash is stored.
	 *
	 * @return array{code:string,expires_at:string}
	 */
	public static function create_challenge( int $operator_id ): array {
		Db::exec( Db::prepare( "DELETE FROM {challenges} WHERE operator_id = %d AND purpose = 'enroll'", $operator_id ) );
		$code    = strtoupper( Random::base32( 10 ) );
		$expires = Clock::now() + self::CHALLENGE_TTL;
		Db::insert(
			'challenges',
			array(
				'code_hash'   => self::challenge_hash( $code ),
				'purpose'     => 'enroll',
				'operator_id' => $operator_id,
				'expires_at'  => Clock::mysql( $expires ),
				'created_at'  => Clock::mysql(),
			)
		);
		return array( 'code' => $code, 'expires_at' => gmdate( 'c', $expires ) );
	}

	public static function challenge_hash( string $code ): string {
		return hash_hmac( 'sha256', 'challenge|' . strtoupper( trim( $code ) ), Secrets::pepper() );
	}

	/**
	 * Consumes a challenge and links the Telegram identity. Atomic: the
	 * UPDATE succeeds for exactly one caller.
	 *
	 * @return array<string,mixed>|null Linked operator.
	 */
	public static function consume_challenge( string $code, string $telegram_user_id, string $username ): ?array {
		if ( ! preg_match( '/^[0-9A-Za-z]{10}$/', trim( $code ) ) || '' === $telegram_user_id ) {
			return null;
		}
		$hash = self::challenge_hash( $code );
		$row  = Db::row( Db::prepare( "SELECT * FROM {challenges} WHERE code_hash = %s AND purpose = 'enroll'", $hash ) );
		if ( ! $row || null !== $row['used_at'] || Clock::to_ts( (string) $row['expires_at'] ) < Clock::now() ) {
			return null;
		}
		$n = Db::exec( Db::prepare( 'UPDATE {challenges} SET used_at = %s WHERE id = %d AND used_at IS NULL', Clock::mysql(), (int) $row['id'] ) );
		if ( 1 !== $n ) {
			return null;
		}
		// Detach the Telegram ID from any other operator first (unique key).
		Db::exec( Db::prepare( 'UPDATE {operators} SET telegram_user_id = NULL WHERE telegram_user_id = %s AND id <> %d', $telegram_user_id, (int) $row['operator_id'] ) );
		Db::update(
			'operators',
			array(
				'telegram_user_id'  => $telegram_user_id,
				'telegram_username' => substr( preg_replace( '/[^A-Za-z0-9_]/', '', $username ) ?? '', 0, 64 ),
				'updated_at'        => Clock::mysql(),
			),
			array( 'id' => (int) $row['operator_id'] )
		);
		Events::record( 'operator.telegram_linked', 'operator', (string) $row['operator_id'], null, 'operator', (string) $row['operator_id'], array( 'telegram_user_id' => $telegram_user_id ) );
		return self::get( (int) $row['operator_id'] );
	}

	public static function unlink_telegram( int $operator_id ): void {
		Db::exec( Db::prepare( 'UPDATE {operators} SET telegram_user_id = NULL, telegram_username = %s WHERE id = %d', '', $operator_id ) );
		list( $actor_type, $actor_ref ) = Events::current_actor();
		Events::record( 'operator.telegram_unlinked', $actor_type, $actor_ref, null, 'operator', (string) $operator_id );
	}

	/**
	 * Explicit availability. "online" set from Telegram lasts until $until;
	 * from the inbox it requires heartbeats.
	 */
	public static function set_availability( int $operator_id, string $availability, ?int $until = null ): void {
		if ( ! in_array( $availability, array( 'online', 'away', 'offline' ), true ) ) {
			return;
		}
		Db::update(
			'operators',
			array(
				'availability'       => $availability,
				'availability_until' => $until ? Clock::mysql( $until ) : null,
				'updated_at'         => Clock::mysql(),
			),
			array( 'id' => $operator_id )
		);
	}

	public static function heartbeat( int $operator_id ): void {
		Db::update( 'operators', array( 'last_heartbeat_at' => Clock::mysql() ), array( 'id' => $operator_id ) );
	}

	/**
	 * An operator is present when explicitly online AND either an inbox
	 * heartbeat arrived recently or a Telegram "online" window is still open.
	 */
	public static function is_present( array $operator ): bool {
		if ( 'active' !== $operator['status'] || 'online' !== $operator['availability'] ) {
			return false;
		}
		$now   = Clock::now();
		$beat  = Clock::to_ts( $operator['last_heartbeat_at'] ?? null );
		$until = Clock::to_ts( $operator['availability_until'] ?? null );
		return ( $beat && $now - $beat <= self::HEARTBEAT_TIMEOUT ) || ( $until && $until > $now );
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function present( ?int $team_id = null ): array {
		$rows = Db::rows( Db::prepare( "SELECT * FROM {operators} WHERE status = 'active' AND availability = 'online'" ) );
		$out  = array();
		foreach ( $rows as $row ) {
			if ( ! self::is_present( $row ) ) {
				continue;
			}
			if ( $team_id && ! in_array( $team_id, self::team_ids( (int) $row['id'] ), true ) ) {
				continue;
			}
			$out[] = $row;
		}
		return $out;
	}
}
