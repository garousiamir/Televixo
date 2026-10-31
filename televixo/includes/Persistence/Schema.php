<?php
/**
 * Custom table definitions.
 *
 * Conventions (see docs/data-model.md):
 * - All DATETIME columns are UTC.
 * - Provider identifiers (Telegram chat, user, message, thread and update IDs)
 *   are stored as VARCHAR(32) strings so 64-bit values never lose precision.
 * - Public identifiers are random 26-character strings; auth secrets are
 *   never stored, only their keyed hashes.
 *
 * @package Televixo
 */

namespace Televixo\Persistence;

defined( 'ABSPATH' ) || exit;

final class Schema {

	/**
	 * Logical table names, without the WordPress prefix.
	 */
	public const TABLES = array(
		'visitors',
		'sessions',
		'conversations',
		'participants',
		'messages',
		'notes',
		'attachments',
		'operators',
		'teams',
		'team_members',
		'assignments',
		'provider_messages',
		'provider_threads',
		'outbox',
		'inbound_updates',
		'rules',
		'trigger_executions',
		'tags',
		'conversation_tags',
		'ratings',
		'events',
		'challenges',
		'rate_limits',
		'canned_replies',
		'kb_articles',
	);

	public static function table( string $name ): string {
		global $wpdb;
		return $wpdb->prefix . 'televixo_' . $name;
	}

	/**
	 * CREATE TABLE statements in dbDelta format (two spaces before PRIMARY KEY,
	 * one definition per line).
	 *
	 * @return string[]
	 */
	public static function statements(): array {
		global $wpdb;
		$c = $wpdb->get_charset_collate();
		$t = static fn( string $n ): string => self::table( $n );

		return array(
			"CREATE TABLE {$t('visitors')} (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  public_id char(26) NOT NULL,
  wp_user_id bigint(20) unsigned DEFAULT NULL,
  name varchar(190) NOT NULL DEFAULT '',
  email varchar(190) NOT NULL DEFAULT '',
  phone varchar(64) NOT NULL DEFAULT '',
  locale varchar(20) NOT NULL DEFAULT '',
  custom_fields longtext NULL,
  consent_at datetime DEFAULT NULL,
  consent_hash char(64) NOT NULL DEFAULT '',
  network_hash char(64) NOT NULL DEFAULT '',
  is_blocked tinyint(1) NOT NULL DEFAULT 0,
  blocked_reason varchar(190) NOT NULL DEFAULT '',
  blocked_at datetime DEFAULT NULL,
  first_seen_at datetime NOT NULL,
  last_seen_at datetime NOT NULL,
  created_at datetime NOT NULL,
  updated_at datetime NOT NULL,
  PRIMARY KEY  (id),
  UNIQUE KEY public_id (public_id),
  KEY wp_user_id (wp_user_id),
  KEY email (email),
  KEY last_seen_at (last_seen_at),
  KEY network_hash (network_hash)
) $c;",
			"CREATE TABLE {$t('sessions')} (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  visitor_id bigint(20) unsigned NOT NULL,
  token_hash char(64) NOT NULL,
  wp_user_id bigint(20) unsigned DEFAULT NULL,
  network_hash char(64) NOT NULL DEFAULT '',
  created_at datetime NOT NULL,
  last_used_at datetime NOT NULL,
  expires_at datetime NOT NULL,
  revoked_at datetime DEFAULT NULL,
  PRIMARY KEY  (id),
  UNIQUE KEY token_hash (token_hash),
  KEY visitor_id (visitor_id),
  KEY expires_at (expires_at)
) $c;",
			"CREATE TABLE {$t('conversations')} (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  public_id char(26) NOT NULL,
  reference varchar(16) NOT NULL,
  visitor_id bigint(20) unsigned NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'pending',
  is_offline tinyint(1) NOT NULL DEFAULT 0,
  department varchar(64) NOT NULL DEFAULT '',
  team_id bigint(20) unsigned DEFAULT NULL,
  assigned_operator_id bigint(20) unsigned DEFAULT NULL,
  priority tinyint(3) unsigned NOT NULL DEFAULT 1,
  routing_mode varchar(16) NOT NULL DEFAULT 'reply',
  routing_snapshot longtext NOT NULL,
  provider_account varchar(32) NOT NULL DEFAULT '',
  provider_chat_id varchar(32) NOT NULL DEFAULT '',
  provider_thread_id varchar(32) NOT NULL DEFAULT '',
  context longtext NULL,
  last_message_id bigint(20) unsigned NOT NULL DEFAULT 0,
  last_message_at datetime DEFAULT NULL,
  last_visitor_message_at datetime DEFAULT NULL,
  first_human_response_at datetime DEFAULT NULL,
  queued_at datetime DEFAULT NULL,
  assigned_at datetime DEFAULT NULL,
  closed_at datetime DEFAULT NULL,
  closed_by varchar(16) NOT NULL DEFAULT '',
  reopened_count int(10) unsigned NOT NULL DEFAULT 0,
  visitor_read_id bigint(20) unsigned NOT NULL DEFAULT 0,
  operator_read_id bigint(20) unsigned NOT NULL DEFAULT 0,
  visitor_typing_until datetime DEFAULT NULL,
  operator_typing_until datetime DEFAULT NULL,
  human_engaged tinyint(1) NOT NULL DEFAULT 0,
  created_at datetime NOT NULL,
  updated_at datetime NOT NULL,
  PRIMARY KEY  (id),
  UNIQUE KEY public_id (public_id),
  UNIQUE KEY reference (reference),
  KEY visitor_status (visitor_id,status),
  KEY status_last (status,last_message_at),
  KEY operator_status (assigned_operator_id,status),
  KEY team_status (team_id,status),
  KEY last_activity (last_message_at,id),
  KEY created_at (created_at)
) $c;",
			"CREATE TABLE {$t('participants')} (
  conversation_id bigint(20) unsigned NOT NULL,
  participant_type varchar(16) NOT NULL,
  participant_ref bigint(20) unsigned NOT NULL,
  joined_at datetime NOT NULL,
  left_at datetime DEFAULT NULL,
  PRIMARY KEY  (conversation_id,participant_type,participant_ref),
  KEY participant (participant_type,participant_ref)
) $c;",
			"CREATE TABLE {$t('messages')} (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  public_id char(26) NOT NULL,
  conversation_id bigint(20) unsigned NOT NULL,
  author_type varchar(16) NOT NULL,
  author_ref bigint(20) unsigned DEFAULT NULL,
  author_name varchar(190) NOT NULL DEFAULT '',
  source varchar(16) NOT NULL DEFAULT 'web',
  body longtext NOT NULL,
  idempotency_key char(64) DEFAULT NULL,
  delivery_state varchar(20) NOT NULL DEFAULT 'local_accepted',
  delivery_error varchar(64) NOT NULL DEFAULT '',
  redacted_at datetime DEFAULT NULL,
  created_at datetime NOT NULL,
  PRIMARY KEY  (id),
  UNIQUE KEY public_id (public_id),
  UNIQUE KEY idempotency_key (idempotency_key),
  KEY conversation_cursor (conversation_id,id),
  KEY author (author_type,author_ref),
  KEY created_at (created_at)
) $c;",
			"CREATE TABLE {$t('notes')} (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  conversation_id bigint(20) unsigned NOT NULL,
  operator_id bigint(20) unsigned DEFAULT NULL,
  author_name varchar(190) NOT NULL DEFAULT '',
  source varchar(16) NOT NULL DEFAULT 'admin',
  body longtext NOT NULL,
  created_at datetime NOT NULL,
  PRIMARY KEY  (id),
  KEY conversation_cursor (conversation_id,id)
) $c;",
			"CREATE TABLE {$t('attachments')} (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  public_id char(26) NOT NULL,
  conversation_id bigint(20) unsigned NOT NULL,
  message_id bigint(20) unsigned DEFAULT NULL,
  uploader_type varchar(16) NOT NULL,
  uploader_ref bigint(20) unsigned DEFAULT NULL,
  storage_name varchar(80) NOT NULL,
  original_name varchar(190) NOT NULL DEFAULT '',
  mime varchar(100) NOT NULL,
  kind varchar(16) NOT NULL DEFAULT 'file',
  size_bytes bigint(20) unsigned NOT NULL DEFAULT 0,
  sha256 char(64) NOT NULL DEFAULT '',
  width int(10) unsigned NOT NULL DEFAULT 0,
  height int(10) unsigned NOT NULL DEFAULT 0,
  status varchar(16) NOT NULL DEFAULT 'pending',
  created_at datetime NOT NULL,
  PRIMARY KEY  (id),
  UNIQUE KEY public_id (public_id),
  KEY conversation_id (conversation_id),
  KEY message_id (message_id),
  KEY status_created (status,created_at)
) $c;",
			"CREATE TABLE {$t('operators')} (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  wp_user_id bigint(20) unsigned NOT NULL,
  display_name varchar(190) NOT NULL DEFAULT '',
  telegram_user_id varchar(32) DEFAULT NULL,
  telegram_username varchar(64) NOT NULL DEFAULT '',
  status varchar(16) NOT NULL DEFAULT 'active',
  availability varchar(16) NOT NULL DEFAULT 'offline',
  availability_until datetime DEFAULT NULL,
  last_heartbeat_at datetime DEFAULT NULL,
  max_concurrent int(10) unsigned NOT NULL DEFAULT 5,
  last_assigned_at datetime DEFAULT NULL,
  created_at datetime NOT NULL,
  updated_at datetime NOT NULL,
  PRIMARY KEY  (id),
  UNIQUE KEY wp_user_id (wp_user_id),
  UNIQUE KEY telegram_user_id (telegram_user_id),
  KEY status (status)
) $c;",
			"CREATE TABLE {$t('teams')} (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  name varchar(190) NOT NULL,
  slug varchar(64) NOT NULL,
  routing_strategy varchar(16) NOT NULL DEFAULT 'manual',
  destination_chat_id varchar(32) NOT NULL DEFAULT '',
  created_at datetime NOT NULL,
  updated_at datetime NOT NULL,
  PRIMARY KEY  (id),
  UNIQUE KEY slug (slug)
) $c;",
			"CREATE TABLE {$t('team_members')} (
  team_id bigint(20) unsigned NOT NULL,
  operator_id bigint(20) unsigned NOT NULL,
  PRIMARY KEY  (team_id,operator_id),
  KEY operator_id (operator_id)
) $c;",
			"CREATE TABLE {$t('assignments')} (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  conversation_id bigint(20) unsigned NOT NULL,
  operator_id bigint(20) unsigned DEFAULT NULL,
  team_id bigint(20) unsigned DEFAULT NULL,
  reason varchar(16) NOT NULL,
  actor_type varchar(16) NOT NULL,
  actor_ref bigint(20) unsigned DEFAULT NULL,
  started_at datetime NOT NULL,
  ended_at datetime DEFAULT NULL,
  PRIMARY KEY  (id),
  KEY conversation_id (conversation_id),
  KEY operator_open (operator_id,ended_at)
) $c;",
			"CREATE TABLE {$t('provider_messages')} (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  provider varchar(16) NOT NULL,
  account_id varchar(32) NOT NULL,
  chat_id varchar(32) NOT NULL,
  provider_message_id varchar(32) NOT NULL,
  thread_id varchar(32) NOT NULL DEFAULT '',
  conversation_id bigint(20) unsigned NOT NULL,
  message_id bigint(20) unsigned DEFAULT NULL,
  attachment_id bigint(20) unsigned DEFAULT NULL,
  part_index smallint(5) unsigned NOT NULL DEFAULT 0,
  direction varchar(8) NOT NULL,
  created_at datetime NOT NULL,
  PRIMARY KEY  (id),
  UNIQUE KEY provider_message (provider,account_id,chat_id,provider_message_id),
  KEY conversation_id (conversation_id),
  KEY message_id (message_id)
) $c;",
			"CREATE TABLE {$t('provider_threads')} (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  provider varchar(16) NOT NULL,
  account_id varchar(32) NOT NULL,
  chat_id varchar(32) NOT NULL,
  thread_id varchar(32) NOT NULL,
  conversation_id bigint(20) unsigned NOT NULL,
  state varchar(16) NOT NULL DEFAULT 'open',
  created_at datetime NOT NULL,
  updated_at datetime NOT NULL,
  PRIMARY KEY  (id),
  UNIQUE KEY provider_thread (provider,account_id,chat_id,thread_id),
  KEY conversation_id (conversation_id)
) $c;",
			"CREATE TABLE {$t('outbox')} (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  job_type varchar(40) NOT NULL,
  ordering_key varchar(64) NOT NULL DEFAULT '',
  conversation_id bigint(20) unsigned DEFAULT NULL,
  message_id bigint(20) unsigned DEFAULT NULL,
  payload longtext NOT NULL,
  progress longtext NULL,
  status varchar(16) NOT NULL DEFAULT 'pending',
  attempts smallint(5) unsigned NOT NULL DEFAULT 0,
  max_attempts smallint(5) unsigned NOT NULL DEFAULT 8,
  available_at datetime NOT NULL,
  lease_token char(32) NOT NULL DEFAULT '',
  lease_expires_at datetime DEFAULT NULL,
  last_error_code varchar(64) NOT NULL DEFAULT '',
  last_error varchar(255) NOT NULL DEFAULT '',
  created_at datetime NOT NULL,
  updated_at datetime NOT NULL,
  completed_at datetime DEFAULT NULL,
  PRIMARY KEY  (id),
  KEY status_available (status,available_at),
  KEY ordering (ordering_key,status,id),
  KEY message_id (message_id),
  KEY completed_at (completed_at)
) $c;",
			"CREATE TABLE {$t('inbound_updates')} (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  provider varchar(16) NOT NULL,
  account_id varchar(32) NOT NULL,
  update_id varchar(32) NOT NULL,
  payload longtext NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'received',
  attempts smallint(5) unsigned NOT NULL DEFAULT 0,
  lease_token char(32) NOT NULL DEFAULT '',
  lease_expires_at datetime DEFAULT NULL,
  result_code varchar(64) NOT NULL DEFAULT '',
  received_at datetime NOT NULL,
  processed_at datetime DEFAULT NULL,
  PRIMARY KEY  (id),
  UNIQUE KEY provider_update (provider,account_id,update_id),
  KEY status_received (status,received_at)
) $c;",
			"CREATE TABLE {$t('rules')} (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  name varchar(190) NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'disabled',
  priority int(11) NOT NULL DEFAULT 10,
  definition longtext NOT NULL,
  revision int(10) unsigned NOT NULL DEFAULT 1,
  created_by bigint(20) unsigned DEFAULT NULL,
  created_at datetime NOT NULL,
  updated_at datetime NOT NULL,
  PRIMARY KEY  (id),
  KEY status_priority (status,priority)
) $c;",
			"CREATE TABLE {$t('trigger_executions')} (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  rule_id bigint(20) unsigned NOT NULL,
  visitor_id bigint(20) unsigned DEFAULT NULL,
  conversation_id bigint(20) unsigned DEFAULT NULL,
  action varchar(32) NOT NULL,
  outcome varchar(16) NOT NULL,
  created_at datetime NOT NULL,
  PRIMARY KEY  (id),
  KEY rule_created (rule_id,created_at),
  KEY visitor_rule (visitor_id,rule_id)
) $c;",
			"CREATE TABLE {$t('tags')} (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  name varchar(64) NOT NULL,
  slug varchar(64) NOT NULL,
  PRIMARY KEY  (id),
  UNIQUE KEY slug (slug)
) $c;",
			"CREATE TABLE {$t('conversation_tags')} (
  conversation_id bigint(20) unsigned NOT NULL,
  tag_id bigint(20) unsigned NOT NULL,
  PRIMARY KEY  (conversation_id,tag_id),
  KEY tag_id (tag_id)
) $c;",
			"CREATE TABLE {$t('ratings')} (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  conversation_id bigint(20) unsigned NOT NULL,
  visitor_id bigint(20) unsigned NOT NULL,
  score tinyint(3) unsigned NOT NULL,
  comment text NULL,
  created_at datetime NOT NULL,
  PRIMARY KEY  (id),
  UNIQUE KEY conversation_id (conversation_id),
  KEY created_at (created_at)
) $c;",
			"CREATE TABLE {$t('events')} (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  event varchar(64) NOT NULL,
  actor_type varchar(16) NOT NULL,
  actor_ref varchar(32) NOT NULL DEFAULT '',
  conversation_id bigint(20) unsigned DEFAULT NULL,
  object_type varchar(32) NOT NULL DEFAULT '',
  object_id varchar(32) NOT NULL DEFAULT '',
  data longtext NULL,
  created_at datetime NOT NULL,
  PRIMARY KEY  (id),
  KEY conversation_id (conversation_id),
  KEY event_created (event,created_at),
  KEY created_at (created_at)
) $c;",
			"CREATE TABLE {$t('challenges')} (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  code_hash char(64) NOT NULL,
  purpose varchar(32) NOT NULL,
  operator_id bigint(20) unsigned NOT NULL,
  attempts smallint(5) unsigned NOT NULL DEFAULT 0,
  expires_at datetime NOT NULL,
  used_at datetime DEFAULT NULL,
  created_at datetime NOT NULL,
  PRIMARY KEY  (id),
  UNIQUE KEY code_hash (code_hash),
  KEY operator_id (operator_id),
  KEY expires_at (expires_at)
) $c;",
			"CREATE TABLE {$t('rate_limits')} (
  bucket char(64) NOT NULL,
  window_start int(10) unsigned NOT NULL,
  hits int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY  (bucket,window_start),
  KEY window_start (window_start)
) $c;",
			"CREATE TABLE {$t('canned_replies')} (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  shortcut varchar(64) NOT NULL,
  title varchar(190) NOT NULL,
  body text NOT NULL,
  created_by bigint(20) unsigned DEFAULT NULL,
  created_at datetime NOT NULL,
  updated_at datetime NOT NULL,
  PRIMARY KEY  (id),
  UNIQUE KEY shortcut (shortcut)
) $c;",
			"CREATE TABLE {$t('kb_articles')} (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  title varchar(190) NOT NULL,
  body text NOT NULL,
  keywords varchar(255) NOT NULL DEFAULT '',
  is_suggested tinyint(1) NOT NULL DEFAULT 0,
  status varchar(16) NOT NULL DEFAULT 'published',
  sort_order int(11) NOT NULL DEFAULT 0,
  created_at datetime NOT NULL,
  updated_at datetime NOT NULL,
  PRIMARY KEY  (id),
  KEY status_sort (status,sort_order)
) $c;",
		);
	}
}
