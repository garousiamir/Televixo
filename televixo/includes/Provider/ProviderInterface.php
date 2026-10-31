<?php
/**
 * Messaging provider contract. Telegram is the shipped implementation; the
 * domain layer only depends on this interface and the normalized models.
 *
 * @package Televixo
 */

namespace Televixo\Provider;

defined( 'ABSPATH' ) || exit;

interface ProviderInterface {

	public function key(): string;

	/**
	 * Whether credentials and a destination are configured.
	 */
	public function is_ready(): bool;

	/**
	 * Whether this provider processes the given outbox job type.
	 */
	public function handles( string $job_type ): bool;

	/**
	 * Executes one leased outbox job. Must be safe to call again for the same
	 * job after a crash: completed parts are recorded in job progress.
	 *
	 * @param array<string,mixed> $job
	 */
	public function process( array $job ): DeliveryResult;

	/**
	 * Processes one stored inbound update.
	 *
	 * @param array<string,mixed> $payload
	 * @return string Result code for the inbound log.
	 */
	public function process_inbound( array $payload, int $attempt ): string;
}
