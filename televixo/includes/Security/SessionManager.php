<?php
/**
 * Anonymous visitor sessions.
 *
 * Design (docs/security.md#visitor-sessions):
 * - A 256-bit random token is issued in an HttpOnly, SameSite=Lax cookie
 *   (Secure on HTTPS). Only HMAC-SHA256(token, server pepper) is stored.
 * - Mutating requests must also send X-Televixo-CSRF, a value derived from
 *   the token and returned to the widget in the JSON body. A cross-site page
 *   can neither read it nor send custom headers without a CORS preflight,
 *   which these routes never grant.
 * - Credentials never appear in URLs.
 * - Sessions expire after 30 days idle and are renewed on use; they can be
 *   revoked by the visitor, an operator (block) or a WordPress logout.
 * - A session created for a logged-in WordPress user is not reused for a
 *   different user (or a logged-out browser), preventing shared-device leaks.
 *
 * @package Televixo
 */

namespace Televixo\Security;

use Televixo\Core\Clock;
use Televixo\Persistence\Db;

defined( 'ABSPATH' ) || exit;

final class SessionManager {

	public const COOKIE      = 'televixo_session';
	public const TTL         = 30 * DAY_IN_SECONDS;
	public const RENEW_AFTER = DAY_IN_SECONDS;

	/** @var array<string,mixed>|null|false Resolved session for this request (false = not resolved yet). */
	private static $current = false;

	/**
	 * Raw token from the request cookie.
	 */
	public static function cookie_token(): string {
		$raw = isset( $_COOKIE[ self::COOKIE ] ) ? (string) wp_unslash( $_COOKIE[ self::COOKIE ] ) : ''; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- format-validated below.
		return preg_match( '/^[A-Za-z0-9_-]{43}$/', $raw ) ? $raw : '';
	}

	public static function hash( string $token ): string {
		return hash_hmac( 'sha256', 'session|' . $token, Secrets::pepper() );
	}

	public static function csrf_for( string $token ): string {
		return substr( hash_hmac( 'sha256', 'csrf|' . $token, Secrets::pepper() ), 0, 40 );
	}

	/**
	 * Validates the cookie session for this request.
	 *
	 * @return array<string,mixed>|null Session row joined with visitor fields.
	 */
	public static function current(): ?array {
		if ( false !== self::$current ) {
			return self::$current;
		}
		self::$current = self::lookup( self::cookie_token(), self::wp_user_id() );
		return self::$current;
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function lookup( string $token, int $wp_user_id ): ?array {
		if ( '' === $token ) {
			return null;
		}
		$row = Db::row(
			Db::prepare(
				'SELECT s.*, v.public_id AS visitor_public_id, v.is_blocked, v.name AS visitor_name, v.email AS visitor_email
				FROM {sessions} s JOIN {visitors} v ON v.id = s.visitor_id
				WHERE s.token_hash = %s',
				self::hash( $token )
			)
		);
		if ( ! $row || null !== $row['revoked_at'] || Clock::to_ts( (string) $row['expires_at'] ) <= Clock::now() ) {
			return null;
		}
		if ( (int) $row['wp_user_id'] !== $wp_user_id ) {
			return null;
		}
		$row['token'] = $token;
		return $row;
	}

	/**
	 * Verifies the CSRF header for the current session.
	 */
	public static function verify_csrf( string $header ): bool {
		$session = self::current();
		if ( ! $session || '' === $header ) {
			return false;
		}
		return hash_equals( self::csrf_for( (string) $session['token'] ), $header );
	}

	/**
	 * Creates a visitor (if needed) and a fresh session, and sets the cookie.
	 *
	 * @return array<string,mixed> Session row with 'token'.
	 */
	public static function create( ?int $visitor_id = null ): array {
		$now     = Clock::mysql();
		$wp_user = self::wp_user_id();
		$network = ClientIp::network_hash();
		$token   = Random::secret( 32 );

		return Db::transaction(
			static function () use ( $visitor_id, $now, $wp_user, $network, $token ): array {
				if ( null === $visitor_id && $wp_user ) {
					$existing   = Db::var( Db::prepare( 'SELECT id FROM {visitors} WHERE wp_user_id = %d ORDER BY id DESC LIMIT 1', $wp_user ) );
					$visitor_id = $existing ? (int) $existing : null;
				}
				if ( null === $visitor_id ) {
					$user       = $wp_user ? get_userdata( $wp_user ) : null;
					$visitor_id = Db::insert(
						'visitors',
						array(
							'public_id'     => Random::public_id(),
							'wp_user_id'    => $wp_user ?: null,
							'name'          => $user ? mb_substr( $user->display_name, 0, 190 ) : '',
							'email'         => $user ? $user->user_email : '',
							'locale'        => substr( determine_locale(), 0, 20 ),
							'network_hash'  => $network,
							'first_seen_at' => $now,
							'last_seen_at'  => $now,
							'created_at'    => $now,
							'updated_at'    => $now,
						)
					);
				}
				Db::insert(
					'sessions',
					array(
						'visitor_id'   => $visitor_id,
						'token_hash'   => self::hash( $token ),
						'wp_user_id'   => $wp_user ?: null,
						'network_hash' => $network,
						'created_at'   => $now,
						'last_used_at' => $now,
						'expires_at'   => Clock::mysql( Clock::now() + self::TTL ),
					)
				);
				self::set_cookie( $token, Clock::now() + self::TTL );
				self::$current = self::lookup( $token, $wp_user );
				return self::$current ?? array();
			}
		);
	}

	/**
	 * Slides expiry forward at most once per RENEW_AFTER.
	 *
	 * @param array<string,mixed> $session
	 */
	public static function touch( array $session ): void {
		$last = Clock::to_ts( (string) $session['last_used_at'] ) ?? 0;
		if ( Clock::now() - $last < self::RENEW_AFTER ) {
			return;
		}
		$expires = Clock::now() + self::TTL;
		Db::update(
			'sessions',
			array(
				'last_used_at' => Clock::mysql(),
				'expires_at'   => Clock::mysql( $expires ),
			),
			array( 'id' => (int) $session['id'] )
		);
		Db::update( 'visitors', array( 'last_seen_at' => Clock::mysql() ), array( 'id' => (int) $session['visitor_id'] ) );
		self::set_cookie( (string) $session['token'], $expires );
	}

	public static function revoke( int $session_id ): void {
		Db::update( 'sessions', array( 'revoked_at' => Clock::mysql() ), array( 'id' => $session_id ) );
		self::$current = null;
	}

	public static function revoke_visitor( int $visitor_id ): int {
		return Db::exec( Db::prepare( 'UPDATE {sessions} SET revoked_at = %s WHERE visitor_id = %d AND revoked_at IS NULL', Clock::mysql(), $visitor_id ) );
	}

	public static function clear_cookie(): void {
		self::set_cookie( '', Clock::now() - YEAR_IN_SECONDS );
	}

	public static function reset_request_cache(): void {
		self::$current = false;
	}

	public static function purge_expired(): int {
		return Db::exec( Db::prepare( 'DELETE FROM {sessions} WHERE expires_at < %s OR (revoked_at IS NOT NULL AND revoked_at < %s)', Clock::mysql( Clock::now() - WEEK_IN_SECONDS ), Clock::mysql( Clock::now() - WEEK_IN_SECONDS ) ) );
	}

	/**
	 * WordPress user from the logged-in cookie. The REST API resets the
	 * current user to 0 without a wp_rest nonce, which cannot be embedded in
	 * cacheable page HTML, so the auth cookie is validated directly. This is
	 * only used to bind a session to a user; it grants no WordPress
	 * capabilities to public routes.
	 */
	public static function wp_user_id(): int {
		if ( is_user_logged_in() ) {
			return get_current_user_id();
		}
		if ( defined( 'LOGGED_IN_COOKIE' ) && ! empty( $_COOKIE[ LOGGED_IN_COOKIE ] ) ) {
			$uid = wp_validate_auth_cookie( '', 'logged_in' );
			return $uid ? (int) $uid : 0;
		}
		return 0;
	}

	private static function set_cookie( string $value, int $expires ): void {
		if ( headers_sent() || ( defined( 'TELEVIXO_TESTING' ) && TELEVIXO_TESTING ) ) {
			$_COOKIE[ self::COOKIE ] = $value;
			return;
		}
		setcookie(
			self::COOKIE,
			$value,
			array(
				'expires'  => $expires,
				'path'     => defined( 'COOKIEPATH' ) && COOKIEPATH ? COOKIEPATH : '/',
				'domain'   => defined( 'COOKIE_DOMAIN' ) && COOKIE_DOMAIN ? COOKIE_DOMAIN : '',
				'secure'   => is_ssl(),
				'httponly' => true,
				'samesite' => 'Lax',
			)
		);
		$_COOKIE[ self::COOKIE ] = $value;
	}
}
