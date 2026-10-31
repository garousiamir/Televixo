<?php
/**
 * Telegram setup wizard and diagnostics (settings managers only).
 *
 * @package Televixo
 */

namespace Televixo\REST;

use Televixo\Core\Clock;
use Televixo\Core\Requirements;
use Televixo\Core\Settings;
use Televixo\Domain\Attachments;
use Televixo\Domain\DomainException;
use Televixo\Domain\Events;
use Televixo\Persistence\Db;
use Televixo\Persistence\Migrator;
use Televixo\Queue\Scheduler;
use Televixo\Security\Capabilities as Caps;
use Televixo\Security\Redactor;
use Televixo\Security\Secrets;
use Televixo\Telegram\BotApi;
use Televixo\Telegram\Health;

defined( 'ABSPATH' ) || exit;

final class SetupController extends Controller {

	public const ALLOWED_UPDATES = array( 'message', 'callback_query', 'my_chat_member' );

	public function register(): void {
		$perm = static fn() => current_user_can( Caps::MANAGE_SETTINGS ) ? true : self::error( 'forbidden', __( 'You do not have permission to do this.', 'televixo' ), is_user_logged_in() ? 403 : 401 );
		$this->route( '/admin/telegram/status', 'GET', array( $this, 'status' ), $perm );
		$this->route( '/admin/telegram/token', 'POST', array( $this, 'set_token' ), $perm );
		$this->route( '/admin/telegram/token', 'DELETE', array( $this, 'remove_token' ), $perm );
		$this->route( '/admin/telegram/detected-chats', 'GET', array( $this, 'detected' ), $perm );
		$this->route( '/admin/telegram/destination', 'POST', array( $this, 'set_destination' ), $perm );
		$this->route( '/admin/telegram/test-message', 'POST', array( $this, 'test_message' ), $perm );
		$this->route( '/admin/telegram/webhook', 'GET', array( $this, 'webhook_info' ), $perm );
		$this->route( '/admin/telegram/webhook', 'POST', array( $this, 'webhook_set' ), $perm );
		$this->route( '/admin/telegram/webhook', 'DELETE', array( $this, 'webhook_delete' ), $perm );
		$this->route( '/admin/diagnostics', 'GET', array( $this, 'diagnostics' ), $perm );
	}

	public static function webhook_url(): string {
		return rest_url( self::NS . '/telegram/webhook' );
	}

	public function status() {
		$t = Settings::get( 'telegram' );
		return array(
			'token_set'        => '' !== Secrets::bot_token(),
			'token_from_config' => Secrets::bot_token_from_config(),
			'bot'              => array( 'id' => $t['bot_id'], 'username' => $t['bot_username'] ),
			'destination'      => array( 'chat_id' => $t['destination_chat_id'], 'title' => $t['destination_title'], 'type' => $t['destination_type'] ),
			'routing_mode'     => $t['routing_mode'],
			'webhook_expected' => self::webhook_url(),
			'webhook_last_seen' => Clock::iso( (string) get_option( 'televixo_webhook_last_seen', '' ) ),
			'health'           => Health::all(),
			'https'            => str_starts_with( self::webhook_url(), 'https://' ),
		);
	}

	/**
	 * Validates a token with getMe and stores it encrypted.
	 */
	public function set_token( \WP_REST_Request $r ) {
		if ( Secrets::bot_token_from_config() ) {
			throw new DomainException( 'token_in_config', __( 'The bot token is defined in wp-config.php and cannot be changed here.', 'televixo' ), 409 );
		}
		$token = trim( self::str( $r, 'token', 100 ) );
		if ( ! BotApi::valid_token_format( $token ) ) {
			throw new DomainException( 'token_invalid', __( 'That does not look like a bot token from @BotFather.', 'televixo' ), 422 );
		}
		$api = new BotApi( $token );
		$me  = $api->call( 'getMe' );
		if ( ! $me->ok() ) {
			throw new DomainException( 'token_rejected', 'auth' === $me->outcome ? __( 'Telegram rejected this token.', 'televixo' ) : __( 'Could not reach Telegram. Check that the server can make outbound HTTPS requests to api.telegram.org.', 'televixo' ), 'auth' === $me->outcome ? 422 : 502 );
		}
		$old_id = (string) Settings::get( 'telegram.bot_id' );
		$new_id = (string) ( $me->result['id'] ?? $api->bot_id() );
		$active = (int) Db::var( Db::prepare( "SELECT COUNT(*) FROM {conversations} WHERE status NOT IN ('closed','spam') AND provider_account = %s", $old_id ) );
		if ( '' !== $old_id && $old_id !== $new_id && $active > 0 && ! rest_sanitize_boolean( $r->get_param( 'confirm_bot_change' ) ) ) {
			return new \WP_Error(
				'bot_change_confirm',
				/* translators: %d: number of active conversations */
				sprintf( __( 'This is a different bot. %d active conversations are routed through the current bot and will stop relaying to Telegram (they remain available in the WordPress inbox). Confirm to continue.', 'televixo' ), $active ),
				array( 'status' => 409, 'active' => $active )
			);
		}
		Secrets::set( 'bot_token', $token );
		Settings::set_internal( 'telegram.bot_id', $new_id );
		Settings::set_internal( 'telegram.bot_username', (string) ( $me->result['username'] ?? '' ) );
		Health::clear( 'token' );
		Events::record( 'telegram.token_set', 'user', (string) get_current_user_id(), null, 'bot', $new_id );
		return array(
			'bot' => array(
				'id'                          => $new_id,
				'username'                    => (string) ( $me->result['username'] ?? '' ),
				'name'                        => (string) ( $me->result['first_name'] ?? '' ),
				'can_join_groups'             => (bool) ( $me->result['can_join_groups'] ?? false ),
				'can_read_all_group_messages' => (bool) ( $me->result['can_read_all_group_messages'] ?? false ),
			),
		);
	}

	public function remove_token() {
		Secrets::set( 'bot_token', '' );
		Events::record( 'telegram.token_removed', 'user', (string) get_current_user_id() );
		return array( 'ok' => true );
	}

	/**
	 * Chats the bot recently received updates from (via the webhook), to
	 * help find the group ID without exposing message content.
	 */
	public function detected() {
		$rows  = Db::rows( Db::prepare( "SELECT payload FROM {inbound_updates} WHERE provider = 'telegram' ORDER BY id DESC LIMIT 100" ) );
		$chats = array();
		foreach ( $rows as $row ) {
			$u = json_decode( (string) $row['payload'], true, 64, JSON_BIGINT_AS_STRING );
			$c = $u['message']['chat'] ?? $u['my_chat_member']['chat'] ?? null;
			if ( is_array( $c ) && isset( $c['id'] ) && ! isset( $chats[ (string) $c['id'] ] ) ) {
				$chats[ (string) $c['id'] ] = array(
					'id'       => (string) $c['id'],
					'type'     => (string) ( $c['type'] ?? '' ),
					'title'    => (string) ( $c['title'] ?? trim( ( $c['first_name'] ?? '' ) . ' ' . ( $c['last_name'] ?? '' ) ) ),
					'is_forum' => ! empty( $c['is_forum'] ),
				);
			}
		}
		return array( 'items' => array_values( $chats ) );
	}

	/**
	 * Verifies a destination chat and the bot's rights for the chosen mode.
	 */
	public function set_destination( \WP_REST_Request $r ) {
		$chat_id = Settings::provider_id( $r->get_param( 'chat_id' ) );
		$mode    = 'topics' === $r->get_param( 'mode' ) ? 'topics' : 'reply';
		if ( '' === $chat_id ) {
			throw new DomainException( 'chat_invalid', __( 'Enter a numeric chat ID (groups start with -100).', 'televixo' ), 422 );
		}
		$api  = new BotApi();
		$chat = $api->call( 'getChat', array( 'chat_id' => $chat_id ) );
		if ( ! $chat->ok() ) {
			throw new DomainException( 'chat_unreachable', __( 'The bot cannot access that chat. Add the bot to the group (or send /start to the bot for a private chat) and try again.', 'televixo' ), 422 );
		}
		$type   = (string) ( $chat->result['type'] ?? '' );
		$checks = array();
		$ok     = true;
		if ( 'channel' === $type ) {
			throw new DomainException( 'chat_channel', __( 'Channels are not supported because operator replies cannot be attributed to individual people. Use a group.', 'televixo' ), 422 );
		}
		if ( 'private' === $type ) {
			if ( 'topics' === $mode ) {
				throw new DomainException( 'topics_need_forum', __( 'Topics Mode needs a supergroup with Topics enabled.', 'televixo' ), 422 );
			}
			$checks[] = array( 'id' => 'private_chat', 'ok' => true, 'message' => __( 'Private chat: only this person will see visitor messages. They must keep the bot unblocked.', 'televixo' ) );
		} else {
			$me     = $api->call( 'getMe' );
			$member = $api->call( 'getChatMember', array( 'chat_id' => $chat_id, 'user_id' => (int) $api->bot_id() ) );
			$status = (string) ( $member->result['status'] ?? '' );
			$admin  = 'administrator' === $status;
			$read_all = (bool) ( $me->result['can_read_all_group_messages'] ?? false );
			$checks[] = array( 'id' => 'bot_member', 'ok' => in_array( $status, array( 'member', 'administrator' ), true ), 'message' => __( 'The bot is a member of the group.', 'televixo' ) );
			$checks[] = array( 'id' => 'group_visibility', 'ok' => true, 'message' => __( 'Every member of this group can read relayed visitor messages. Use separate groups per team (or the WordPress inbox) when visitors must be isolated between teams.', 'televixo' ) );
			if ( 'reply' === $mode ) {
				$checks[] = array( 'id' => 'privacy_mode', 'ok' => true, 'message' => $read_all || $admin ? __( 'The bot can read group messages.', 'televixo' ) : __( 'Privacy mode is on: the bot only receives replies to its own messages and commands, which is all Reply Mode needs.', 'televixo' ) );
			} else {
				$forum = ! empty( $chat->result['is_forum'] );
				$topic = $admin && ! empty( $member->result['can_manage_topics'] );
				$checks[] = array( 'id' => 'forum', 'ok' => $forum, 'message' => $forum ? __( 'Topics are enabled.', 'televixo' ) : __( 'Enable Topics in the group settings (requires a supergroup).', 'televixo' ) );
				$checks[] = array( 'id' => 'can_manage_topics', 'ok' => $topic, 'message' => $topic ? __( 'The bot can create and close topics.', 'televixo' ) : __( 'Make the bot an administrator with the "Manage topics" right.', 'televixo' ) );
				$checks[] = array( 'id' => 'receive_topic_messages', 'ok' => $admin || $read_all, 'message' => $admin || $read_all ? __( 'The bot receives messages inside topics.', 'televixo' ) : __( 'The bot must be an administrator (or have privacy mode disabled in @BotFather) to receive messages typed inside topics.', 'televixo' ) );
				$ok = $forum && $topic && ( $admin || $read_all );
			}
		}
		if ( ! $ok && ! rest_sanitize_boolean( $r->get_param( 'save_anyway' ) ) ) {
			return array( 'saved' => false, 'checks' => $checks, 'chat' => array( 'id' => $chat_id, 'type' => $type, 'title' => (string) ( $chat->result['title'] ?? '' ) ) );
		}
		$before = Settings::get( 'telegram' );
		Settings::set_internal( 'telegram.destination_chat_id', $chat_id );
		Settings::set_internal( 'telegram.destination_title', mb_substr( (string) ( $chat->result['title'] ?? trim( ( $chat->result['first_name'] ?? '' ) . ' ' . ( $chat->result['last_name'] ?? '' ) ) ), 0, 120 ) );
		Settings::set_internal( 'telegram.destination_type', $type );
		Settings::set_internal( 'telegram.routing_mode', $mode );
		Health::clear( 'destination' );
		Health::clear( 'topics' );
		Events::record( 'telegram.destination_set', 'user', (string) get_current_user_id(), null, 'chat', $chat_id, array( 'mode' => $mode, 'previous_chat' => $before['destination_chat_id'], 'previous_mode' => $before['routing_mode'] ) );
		return array( 'saved' => true, 'checks' => $checks, 'note' => __( 'New conversations use this destination. Existing conversations keep the routing they started with.', 'televixo' ) );
	}

	public function test_message() {
		$chat = (string) Settings::get( 'telegram.destination_chat_id' );
		if ( '' === $chat ) {
			throw new DomainException( 'not_configured', __( 'Choose a destination first.', 'televixo' ), 409 );
		}
		$res = ( new BotApi() )->call( 'sendMessage', array( 'chat_id' => $chat, 'text' => __( '✅ Televixo test message. Visitor chats from your website will appear here.', 'televixo' ) ) );
		if ( ! $res->ok() ) {
			throw new DomainException( $res->error_code_slug(), Redactor::text( $res->description ) ?: __( 'Telegram did not accept the message.', 'televixo' ), 502 );
		}
		return array( 'ok' => true, 'note' => __( 'Telegram accepted the message. That confirms delivery to the chat, not that someone has read it.', 'televixo' ) );
	}

	public function webhook_info() {
		$res = ( new BotApi() )->call( 'getWebhookInfo' );
		if ( ! $res->ok() ) {
			throw new DomainException( $res->error_code_slug(), __( 'Could not read the webhook status from Telegram.', 'televixo' ), 502 );
		}
		$url = (string) ( $res->result['url'] ?? '' );
		return array(
			'registered'      => '' !== $url,
			'ours'            => $url === self::webhook_url(),
			'other_host'      => '' !== $url && $url !== self::webhook_url() ? (string) wp_parse_url( $url, PHP_URL_HOST ) : '',
			'pending'         => (int) ( $res->result['pending_update_count'] ?? 0 ),
			'last_error'      => isset( $res->result['last_error_message'] ) ? Redactor::text( (string) $res->result['last_error_message'] ) : '',
			'last_error_date' => isset( $res->result['last_error_date'] ) ? gmdate( 'c', (int) $res->result['last_error_date'] ) : null,
			'allowed_updates' => (array) ( $res->result['allowed_updates'] ?? array() ),
			'expected'        => self::webhook_url(),
		);
	}

	/**
	 * Registers the webhook. Refuses to silently replace a webhook pointing
	 * elsewhere (another site may be using this bot).
	 */
	public function webhook_set( \WP_REST_Request $r ) {
		$url = self::webhook_url();
		if ( ! str_starts_with( $url, 'https://' ) ) {
			throw new DomainException( 'https_required', __( 'Telegram webhooks require HTTPS. Enable HTTPS on this site first.', 'televixo' ), 409 );
		}
		$api  = new BotApi();
		$info = $api->call( 'getWebhookInfo' );
		$cur  = $info->ok() ? (string) ( $info->result['url'] ?? '' ) : '';
		if ( '' !== $cur && $cur !== $url && ! rest_sanitize_boolean( $r->get_param( 'confirm_replace' ) ) ) {
			return new \WP_Error(
				'webhook_in_use',
				/* translators: %s: host name of the other webhook */
				sprintf( __( 'This bot already sends updates to %s. Replacing it will stop that integration. Use a dedicated bot for this site, or confirm to replace.', 'televixo' ), (string) wp_parse_url( $cur, PHP_URL_HOST ) ),
				array( 'status' => 409 )
			);
		}
		$res = $api->call(
			'setWebhook',
			array(
				'url'                  => $url,
				'secret_token'         => Secrets::webhook_secret(),
				'allowed_updates'      => self::ALLOWED_UPDATES,
				'max_connections'      => 10,
				'drop_pending_updates' => false,
			)
		);
		if ( ! $res->ok() ) {
			throw new DomainException( $res->error_code_slug(), Redactor::text( $res->description ) ?: __( 'Telegram did not accept the webhook.', 'televixo' ), 502 );
		}
		Settings::set_internal( 'telegram.webhook_url', $url );
		Settings::set_internal( 'telegram.webhook_owner', Secrets::install_id() );
		Events::record( 'telegram.webhook_set', 'user', (string) get_current_user_id(), null, '', '', array( 'replaced_other' => '' !== $cur && $cur !== $url ) );
		return $this->webhook_info();
	}

	/**
	 * Removes the webhook only if it still points at this site.
	 */
	public function webhook_delete( \WP_REST_Request $r ) {
		$result = self::remove_owned_webhook( rest_sanitize_boolean( $r->get_param( 'force' ) ) );
		if ( 'other' === $result ) {
			throw new DomainException( 'webhook_not_ours', __( 'The registered webhook belongs to another site, so it was left unchanged.', 'televixo' ), 409 );
		}
		return array( 'result' => $result );
	}

	/**
	 * @return string removed|none|other|error
	 */
	public static function remove_owned_webhook( bool $force = false ): string {
		$api = new BotApi();
		if ( ! $api->has_token() ) {
			return 'none';
		}
		$info = $api->call( 'getWebhookInfo' );
		if ( ! $info->ok() ) {
			return 'error';
		}
		$cur = (string) ( $info->result['url'] ?? '' );
		if ( '' === $cur ) {
			return 'none';
		}
		if ( $cur !== self::webhook_url() && ! $force ) {
			return 'other';
		}
		$res = $api->call( 'deleteWebhook', array( 'drop_pending_updates' => false ) );
		if ( $res->ok() ) {
			Settings::set_internal( 'telegram.webhook_url', '' );
			return 'removed';
		}
		return 'error';
	}

	/**
	 * Redacted diagnostics: safe to copy into a support ticket.
	 */
	public function diagnostics() {
		global $wpdb;
		$probe = self::storage_probe();
		return array(
			'versions'   => array(
				'plugin'    => TELEVIXO_VERSION,
				'wordpress' => get_bloginfo( 'version' ),
				'php'       => PHP_VERSION,
				'database'  => Requirements::database(),
				'db_schema' => Migrator::installed_version(),
			),
			'problems'   => Requirements::problems(),
			'warnings'   => Requirements::warnings(),
			'missing_tables' => Migrator::missing_tables(),
			'queue'      => Scheduler::health(),
			'health'     => Health::all(),
			'secrets'    => array(
				'key_source'    => Secrets::key_source(),
				'undecryptable' => Secrets::undecryptable(),
				'token_set'     => '' !== Secrets::bot_token(),
			),
			'storage'    => $probe,
			'webhook_last_seen' => Clock::iso( (string) get_option( 'televixo_webhook_last_seen', '' ) ),
			'maintenance_last_run' => Clock::iso( (string) get_option( 'televixo_maintenance_last_run', '' ) ),
			'object_cache' => wp_using_ext_object_cache(),
			'multisite'  => is_multisite(),
			'charset'    => $wpdb->charset,
			'recent_errors' => array_map(
				static fn( $e ) => array( 'event' => $e['event'], 'at' => Clock::iso( $e['created_at'] ), 'data' => json_decode( (string) $e['data'], true ) ),
				Db::rows( Db::prepare( "SELECT event, data, created_at FROM {events} WHERE event LIKE %s ORDER BY id DESC LIMIT 20", '%fail%' ) )
			),
		);
	}

	/**
	 * Checks whether private attachment storage is reachable over HTTP. If a
	 * canary file inside it can be fetched, the server ignores the deny
	 * rules (common on Nginx) and the admin must add a server rule or define
	 * TELEVIXO_STORAGE_DIR outside the web root.
	 *
	 * @return array<string,mixed>
	 */
	public static function storage_probe(): array {
		$dir = Attachments::storage_dir();
		if ( defined( 'TELEVIXO_STORAGE_DIR' ) ) {
			return array( 'location' => 'custom', 'publicly_reachable' => null );
		}
		$name = 'probe-' . wp_generate_password( 12, false ) . '.txt';
		file_put_contents( $dir . '/' . $name, 'televixo-probe' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
		$uploads = wp_upload_dir( null, false );
		$url     = trailingslashit( $uploads['baseurl'] ) . basename( $dir ) . '/' . $name;
		$res     = wp_remote_get( $url, array( 'timeout' => 5, 'redirection' => 0, 'sslverify' => false ) );
		wp_delete_file( $dir . '/' . $name );
		$public = ! is_wp_error( $res ) && 200 === (int) wp_remote_retrieve_response_code( $res ) && str_contains( (string) wp_remote_retrieve_body( $res ), 'televixo-probe' );
		return array(
			'location'           => 'uploads',
			'publicly_reachable' => is_wp_error( $res ) ? null : $public,
			'nginx_rule'         => 'location ~* /wp-content/uploads/televixo-private-[a-f0-9]+/ { deny all; }',
		);
	}
}
