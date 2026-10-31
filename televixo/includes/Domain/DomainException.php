<?php
/**
 * Business rule violation with a stable, client-safe error code.
 *
 * @package Televixo
 */

namespace Televixo\Domain;

defined( 'ABSPATH' ) || exit;

class DomainException extends \RuntimeException {

	public string $error_code;
	public int $status;

	public function __construct( string $error_code, string $message, int $status = 400 ) {
		$this->error_code = $error_code;
		$this->status     = $status;
		parent::__construct( $message );
	}
}
