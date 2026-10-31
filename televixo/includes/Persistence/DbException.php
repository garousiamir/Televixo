<?php
/**
 * Database failure. The message holds the database error and must not be
 * shown to visitors.
 *
 * @package Televixo
 */

namespace Televixo\Persistence;

defined( 'ABSPATH' ) || exit;

final class DbException extends \RuntimeException {

	public string $error_code;

	public function __construct( string $code, string $detail ) {
		$this->error_code = $code;
		parent::__construct( $code . ': ' . $detail );
	}
}
