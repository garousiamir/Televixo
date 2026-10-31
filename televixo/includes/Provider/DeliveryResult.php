<?php
/**
 * Normalized result of processing an outbox job.
 *
 * @package Televixo
 */

namespace Televixo\Provider;

defined( 'ABSPATH' ) || exit;

final class DeliveryResult {

	public const DONE      = 'done';
	public const RETRY     = 'retry';
	public const UNCERTAIN = 'uncertain';
	public const FAILED    = 'failed';

	public function __construct(
		public string $status,
		public string $code = '',
		public string $error = '',
		public ?int $retry_after = null
	) {}

	public static function done(): self {
		return new self( self::DONE );
	}

	public static function retry( string $code, string $error, ?int $retry_after = null ): self {
		return new self( self::RETRY, $code, $error, $retry_after );
	}

	public static function uncertain( string $code, string $error ): self {
		return new self( self::UNCERTAIN, $code, $error );
	}

	public static function failed( string $code, string $error ): self {
		return new self( self::FAILED, $code, $error );
	}
}
