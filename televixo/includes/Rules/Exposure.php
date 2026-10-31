<?php
/**
 * Server-side record of trigger exposure for reporting (conversion) and
 * cross-device-insensitive auditing. Runtime frequency caps are enforced in
 * the browser with disclosed first-party storage.
 *
 * @package Televixo
 */

namespace Televixo\Rules;

use Televixo\Core\Clock;
use Televixo\Persistence\Db;

defined( 'ABSPATH' ) || exit;

final class Exposure {

	public const OUTCOMES = array( 'shown', 'clicked', 'dismissed' );

	public static function record( int $rule_id, int $visitor_id, string $action, string $outcome ): void {
		if ( ! in_array( $outcome, self::OUTCOMES, true ) || ! in_array( $action, Schema::ACTIONS, true ) ) {
			return;
		}
		if ( ! Db::var( Db::prepare( "SELECT 1 FROM {rules} WHERE id = %d AND status = 'enabled'", $rule_id ) ) ) {
			return;
		}
		Db::insert(
			'trigger_executions',
			array(
				'rule_id'    => $rule_id,
				'visitor_id' => $visitor_id,
				'action'     => $action,
				'outcome'    => $outcome,
				'created_at' => Clock::mysql(),
			)
		);
	}
}
