<?php
/**
 * Server-side Telegram Bot API client.
 *
 * - The host is fixed to api.telegram.org over HTTPS; there is no
 *   configurable proxy/base URL (SSRF guard). Redirects are not followed.
 * - The token only ever appears in the request URL built here; errors are
 *   passed through Redactor before storage or display.
 *
 * @package Televixo
 */

namespace Televixo\Telegram;

use Televixo\Security\Redactor;
use Televixo\Security\Secrets;

defined( 'ABSPATH' ) || exit;

class BotApi {

	public const HOST = 'api.telegram.org';

	private string $token;

	public function __construct( ?string $token = null ) {
		$this->token = $token ?? Secrets::bot_token();
	}

	public static function valid_token_format( string $token ): bool {
		return (bool) preg_match( '/^\d{5,20}:[A-Za-z0-9_-]{30,60}$/', $token );
	}

	public function has_token(): bool {
		return '' !== $this->token;
	}

	public function bot_id(): string {
		$parts = explode( ':', $this->token, 2 );
		return ctype_digit( $parts[0] ) ? $parts[0] : '';
	}

	/**
	 * @param array<string,mixed> $params
	 * @param array<string,array{path:string,name:string,mime:string}> $files
	 */
	public function call( string $method, array $params = array(), array $files = array(), int $timeout = 10 ): ApiResponse {
		if ( ! $this->has_token() ) {
			return new ApiResponse( 'auth', null, 0, 0, 'Bot token is not configured.', null, '', 'not_configured' );
		}
		if ( ! preg_match( '/^[a-zA-Z]{3,40}$/', $method ) ) {
			return new ApiResponse( 'permanent', null, 0, 0, 'Invalid method.', null, '', 'invalid_method' );
		}
		$url  = 'https://' . self::HOST . '/bot' . $this->token . '/' . $method;
		$args = array(
			'timeout'     => $timeout,
			'redirection' => 0,
			'sslverify'   => true,
			'user-agent'  => 'Televixo/' . ( defined( 'TELEVIXO_VERSION' ) ? TELEVIXO_VERSION : '1' ) . '; WordPress',
		);
		if ( $files ) {
			$boundary              = 'tvx' . bin2hex( random_bytes( 12 ) );
			$args['headers']       = array( 'Content-Type' => 'multipart/form-data; boundary=' . $boundary );
			$args['body']          = self::multipart( $boundary, $params, $files );
			$args['timeout']       = max( $timeout, 60 );
		} else {
			$args['headers'] = array( 'Content-Type' => 'application/json' );
			$args['body']    = wp_json_encode( $params );
		}
		$response = wp_remote_post( $url, $args );
		return self::classify( $response );
	}

	/**
	 * @param array<string,mixed>|\WP_Error $response
	 */
	public static function classify( $response ): ApiResponse {
		if ( is_wp_error( $response ) ) {
			$msg = Redactor::text( $response->get_error_message() );
			// cURL 28 = timed out: the request may already have been processed.
			if ( preg_match( '/cURL error 28|timed out|Operation timed out/i', $msg ) ) {
				return new ApiResponse( 'uncertain', null, 0, 0, $msg, null, '', 'timeout' );
			}
			// cURL 52 (empty reply) and 56 (recv failure) happen after sending.
			if ( preg_match( '/cURL error (52|56)/', $msg ) ) {
				return new ApiResponse( 'uncertain', null, 0, 0, $msg, null, '', 'connection_reset' );
			}
			return new ApiResponse( 'retryable', null, 0, 0, $msg, null, '', 'network_error' );
		}
		$status = (int) wp_remote_retrieve_response_code( $response );
		$raw    = (string) wp_remote_retrieve_body( $response );
		$body   = json_decode( $raw, true, 64, JSON_BIGINT_AS_STRING );
		if ( ! is_array( $body ) || ! array_key_exists( 'ok', $body ) ) {
			if ( $status >= 200 && $status < 300 ) {
				return new ApiResponse( 'uncertain', null, $status, 0, 'Malformed response body.', null, '', 'malformed_response' );
			}
			if ( 504 === $status ) {
				return new ApiResponse( 'uncertain', null, $status, 0, 'Gateway timeout.', null, '', 'gateway_timeout' );
			}
			if ( $status >= 500 || 0 === $status ) {
				return new ApiResponse( 'retryable', null, $status, 0, 'Server error.', null, '', 'server_error' );
			}
			return new ApiResponse( 404 === $status || 401 === $status ? 'auth' : 'permanent', null, $status, $status, 'Unexpected response.', null, '', 'unexpected_response' );
		}
		if ( true === $body['ok'] ) {
			return new ApiResponse( 'ok', $body['result'] ?? null, $status );
		}
		$code        = (int) ( $body['error_code'] ?? $status );
		$desc        = Redactor::text( (string) ( $body['description'] ?? '' ) );
		$params      = is_array( $body['parameters'] ?? null ) ? $body['parameters'] : array();
		$retry_after = isset( $params['retry_after'] ) ? (int) $params['retry_after'] : null;
		$migrate     = isset( $params['migrate_to_chat_id'] ) ? (string) $params['migrate_to_chat_id'] : '';
		if ( 429 === $code ) {
			return new ApiResponse( 'retryable', null, $status, $code, $desc, $retry_after ?? 30 );
		}
		if ( 401 === $code || 404 === $code ) {
			return new ApiResponse( 'auth', null, $status, $code, $desc );
		}
		if ( $code >= 500 ) {
			return new ApiResponse( 'retryable', null, $status, $code, $desc, $retry_after );
		}
		return new ApiResponse( 'permanent', null, $status, $code, $desc, $retry_after, $migrate );
	}

	/**
	 * @param array<string,mixed> $params
	 * @param array<string,array{path:string,name:string,mime:string}> $files
	 */
	private static function multipart( string $boundary, array $params, array $files ): string {
		$eol  = "\r\n";
		$body = '';
		foreach ( $params as $name => $value ) {
			if ( null === $value ) {
				continue;
			}
			if ( is_array( $value ) || is_bool( $value ) ) {
				$value = wp_json_encode( $value );
			}
			$body .= '--' . $boundary . $eol
				. 'Content-Disposition: form-data; name="' . $name . '"' . $eol . $eol
				. $value . $eol;
		}
		foreach ( $files as $field => $file ) {
			$name  = str_replace( array( '"', "\r", "\n" ), '', $file['name'] );
			$body .= '--' . $boundary . $eol
				. 'Content-Disposition: form-data; name="' . $field . '"; filename="' . $name . '"' . $eol
				. 'Content-Type: ' . $file['mime'] . $eol . $eol
				. (string) file_get_contents( $file['path'] ) . $eol; // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
		}
		return $body . '--' . $boundary . '--' . $eol;
	}

	/**
	 * Downloads a file Telegram reports via getFile. The path comes from the
	 * API, is validated, and the size is capped before and during download.
	 *
	 * @return string|null Temp file path.
	 */
	public function download( string $file_path, int $max_bytes ): ?string {
		if ( ! preg_match( '#^[A-Za-z0-9_./-]{1,200}$#', $file_path ) || str_contains( $file_path, '..' ) ) {
			return null;
		}
		$tmp = wp_tempnam( 'televixo' );
		$res = wp_remote_get(
			'https://' . self::HOST . '/file/bot' . $this->token . '/' . $file_path,
			array(
				'timeout'             => 30,
				'redirection'         => 0,
				'stream'              => true,
				'filename'            => $tmp,
				'limit_response_size' => $max_bytes + 1,
			)
		);
		if ( is_wp_error( $res ) || 200 !== (int) wp_remote_retrieve_response_code( $res ) || filesize( $tmp ) > $max_bytes ) {
			wp_delete_file( $tmp );
			return null;
		}
		return $tmp;
	}
}
