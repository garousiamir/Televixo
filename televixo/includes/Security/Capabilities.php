<?php
/**
 * Granular capabilities. UI visibility is never a substitute for these checks;
 * every REST route calls them in its permission_callback and services check
 * conversation-level access again.
 *
 * @package Televixo
 */

namespace Televixo\Security;

defined( 'ABSPATH' ) || exit;

final class Capabilities {

	public const MANAGE_SETTINGS = 'televixo_manage_settings';
	public const HANDLE_ASSIGNED = 'televixo_handle_assigned';
	public const VIEW_ALL        = 'televixo_view_all';
	public const VIEW_REPORTS    = 'televixo_view_reports';
	public const EXPORT          = 'televixo_export';
	public const DELETE          = 'televixo_delete';

	public const ALL = array(
		self::MANAGE_SETTINGS,
		self::HANDLE_ASSIGNED,
		self::VIEW_ALL,
		self::VIEW_REPORTS,
		self::EXPORT,
		self::DELETE,
	);

	public const OPERATOR_ROLE = 'televixo_operator';

	public static function install(): void {
		$admin = get_role( 'administrator' );
		if ( $admin ) {
			foreach ( self::ALL as $cap ) {
				$admin->add_cap( $cap );
			}
		}
		if ( ! get_role( self::OPERATOR_ROLE ) ) {
			add_role(
				self::OPERATOR_ROLE,
				__( 'Chat Operator', 'televixo' ),
				array(
					'read'                => true,
					self::HANDLE_ASSIGNED => true,
				)
			);
		}
	}

	public static function uninstall(): void {
		foreach ( wp_roles()->roles as $name => $info ) {
			$role = get_role( $name );
			if ( $role ) {
				foreach ( self::ALL as $cap ) {
					$role->remove_cap( $cap );
				}
			}
		}
		remove_role( self::OPERATOR_ROLE );
	}

	public static function can_use_inbox( int $user_id = 0 ): bool {
		$user_id = $user_id ?: get_current_user_id();
		return user_can( $user_id, self::HANDLE_ASSIGNED ) || user_can( $user_id, self::VIEW_ALL );
	}
}
