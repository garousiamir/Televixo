<?php
/**
 * Shared REST helpers: stable error envelopes, no-store headers, body limits
 * and visitor session authorization.
 *
 * Error envelope: { "code": "<stable_code>", "message": "<localized>", "data": { "status": <http> } }
 *
 * @package Televixo
 */

namespace Televixo\REST;

use Televixo\Domain\DomainException;
use Televixo\Domain\Visitors;
use Televixo\Persistence\DbException;
use Televixo\Security\ClientIp;
use Televixo\Security\SessionManager;

defined( 'ABSPATH' ) || exit;

abstract class Controller {

	public const NS = 'televixo/v1';
	public const MAX_JSON_BYTES = 65536;

	abstract public function register(): void;

	protected function route( string $path, string $methods, callable $callback, callable $permission, array $args = array() ): void {
		register_rest_route(
			self::NS,
			$path,
			array(
				'methods'             => $methods,
				'callback'            => function ( \WP_REST_Request $request ) use ( $callback ) {
					try {
						$response = rest_ensure_response( $callback( $request ) );
					} catch ( DomainException $e ) {
						$response = self::error( $e->error_code, $e->getMessage(), $e->status );
					} catch ( DbException $e ) {
						$response = self::error( 'server_error', __( 'Something went wrong. Please try again.', 'televixo' ), 500 );
					}
					if ( $response instanceof \WP_REST_Response ) {
						$response->header( 'Cache-Control', 'no-store, private, max-age=0' );
						$response->header( 'X-Content-Type-Options', 'nosniff' );
					}
					return $response;
				},
				'permission_callback' => $permission,
				'args'                => $args,
			)
		);
	}

	public static function error( string $code, string $message, int $status ): \WP_Error {
		return new \WP_Error( $code, $message, array( 'status' => $status ) );
	}

	/**
	 * Permission callback for visitor routes that read data.
	 *
	 * @return true|\WP_Error
	 */
	public function visitor_read( \WP_REST_Request $request ) {
		$session = SessionManager::current();
		if ( ! $session ) {
			return self::error( 'session_required', __( 'Your chat session has expired. Please reload the page.', 'televixo' ), 401 );
		}
		if ( (int) $session['is_blocked'] ) {
			return self::error( 'visitor_blocked', __( 'Chat is not available.', 'televixo' ), 403 );
		}
		return true;
	}

	/**
	 * Permission callback for visitor routes that change data: session cookie
	 * plus the CSRF header, JSON body size bound.
	 *
	 * @return true|\WP_Error
	 */
	public function visitor_write( \WP_REST_Request $request ) {
		$ok = $this->visitor_read( $request );
		if ( true !== $ok ) {
			return $ok;
		}
		if ( ! SessionManager::verify_csrf( (string) $request->get_header( 'X-Televixo-CSRF' ) ) ) {
			return self::error( 'csrf_failed', __( 'Your chat session needs to be refreshed. Please reload the page.', 'televixo' ), 403 );
		}
		if ( strlen( (string) $request->get_body() ) > self::MAX_JSON_BYTES && ! $request->get_file_params() ) {
			return self::error( 'payload_too_large', __( 'Request is too large.', 'televixo' ), 413 );
		}
		if ( Visitors::network_blocked( ClientIp::network_hash() ) ) {
			return self::error( 'visitor_blocked', __( 'Chat is not available.', 'televixo' ), 403 );
		}
		return true;
	}

	/**
	 * @return array<string,mixed>
	 */
	protected function session(): array {
		return SessionManager::current() ?? array();
	}

	protected function visitor_id(): int {
		return (int) ( $this->session()['visitor_id'] ?? 0 );
	}

	protected static function str( \WP_REST_Request $r, string $key, int $max = 190 ): string {
		$v = $r->get_param( $key );
		return is_scalar( $v ) ? mb_substr( trim( (string) $v ), 0, $max ) : '';
	}
}
