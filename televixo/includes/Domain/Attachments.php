<?php
/**
 * Attachment storage.
 *
 * Bytes are stored with random, extension-less names in a private directory:
 * TELEVIXO_STORAGE_DIR when defined (recommended: outside the web root),
 * otherwise wp-content/uploads/televixo-private-<random>/ guarded by
 * .htaccess, web.config and index.php. Because Nginx ignores .htaccess,
 * diagnostics probe public reachability over HTTP and warn with a server
 * rule; files are also never named with an executable extension.
 * Downloads always go through an ownership-checked REST route.
 *
 * @package Televixo
 */

namespace Televixo\Domain;

use Televixo\Core\Clock;
use Televixo\Core\Settings;
use Televixo\Persistence\Db;
use Televixo\Security\FileInspector;
use Televixo\Security\Random;

defined( 'ABSPATH' ) || exit;

final class Attachments {

	public static function storage_dir(): string {
		if ( defined( 'TELEVIXO_STORAGE_DIR' ) && is_string( TELEVIXO_STORAGE_DIR ) && '' !== TELEVIXO_STORAGE_DIR ) {
			$dir = rtrim( TELEVIXO_STORAGE_DIR, '/\\' );
		} else {
			$suffix = (string) get_option( 'televixo_storage_suffix', '' );
			if ( '' === $suffix ) {
				$suffix = Random::hex( 16 );
				update_option( 'televixo_storage_suffix', $suffix, false );
			}
			$uploads = wp_upload_dir( null, false );
			$dir     = rtrim( (string) $uploads['basedir'], '/\\' ) . '/televixo-private-' . $suffix;
		}
		if ( ! is_dir( $dir ) ) {
			wp_mkdir_p( $dir );
		}
		self::protect( $dir );
		return $dir;
	}

	public static function protect( string $dir ): void {
		$files = array(
			'.htaccess'  => "# Televixo private storage\n<IfModule mod_authz_core.c>\nRequire all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\nDeny from all\n</IfModule>\nOptions -Indexes\n",
			'web.config' => '<?xml version="1.0" encoding="UTF-8"?><configuration><system.webServer><authorization><deny users="*" /></authorization></system.webServer></configuration>',
			'index.php'  => "<?php\n// Silence is golden.\n",
		);
		foreach ( $files as $name => $content ) {
			$path = $dir . '/' . $name;
			if ( ! file_exists( $path ) ) {
				file_put_contents( $path, $content ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
			}
		}
	}

	public static function path_of( array $attachment ): string {
		return self::storage_dir() . '/' . basename( (string) $attachment['storage_name'] );
	}

	/**
	 * Validates and stores a file. The temp file is moved, never left in place.
	 *
	 * @return array<string,mixed> Attachment row.
	 * @throws DomainException On validation failure.
	 */
	public static function store( array $conversation, string $tmp_path, string $client_name, string $uploader_type, ?int $uploader_ref, bool $is_uploaded_file = true ): array {
		$enabled = (array) Settings::get( 'uploads.types', array() );
		if ( Settings::get( 'uploads.voice' ) ) {
			$enabled = array_merge( $enabled, array( 'ogg', 'mp3', 'm4a' ) );
		}
		$max     = (int) Settings::get( 'uploads.max_mb', 10 ) * MB_IN_BYTES;
		if ( 'operator' === $uploader_type ) {
			$enabled = array_keys( FileInspector::ALLOWED );
			$max     = 20 * MB_IN_BYTES;
		}
		$check = FileInspector::inspect( $tmp_path, $client_name, $enabled, $max );
		if ( ! $check['ok'] ) {
			throw new DomainException( (string) $check['error'], self::error_text( (string) $check['error'] ), 'file_too_large' === $check['error'] ? 413 : 415 );
		}
		$used  = (int) Db::var( Db::prepare( "SELECT COALESCE(SUM(size_bytes),0) FROM {attachments} WHERE conversation_id = %d AND status <> 'deleted'", (int) $conversation['id'] ) );
		$size  = (int) filesize( $tmp_path );
		$quota = (int) Settings::get( 'uploads.quota_per_conversation_mb', 50 ) * MB_IN_BYTES;
		if ( $used + $size > $quota ) {
			throw new DomainException( 'quota_exceeded', __( 'Upload quota for this conversation is used up.', 'televixo' ), 413 );
		}
		$storage = Random::hex( 20 ) . '.bin';
		$dest    = self::storage_dir() . '/' . $storage;
		$moved   = $is_uploaded_file ? move_uploaded_file( $tmp_path, $dest ) : rename( $tmp_path, $dest ); // phpcs:ignore WordPress.WP.AlternativeFunctions.rename_rename
		if ( ! $moved ) {
			throw new DomainException( 'storage_failed', __( 'The file could not be stored.', 'televixo' ), 500 );
		}
		chmod( $dest, 0640 ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_chmod
		$id = Db::insert(
			'attachments',
			array(
				'public_id'       => Random::public_id(),
				'conversation_id' => (int) $conversation['id'],
				'uploader_type'   => $uploader_type,
				'uploader_ref'    => $uploader_ref,
				'storage_name'    => $storage,
				'original_name'   => (string) $check['name'],
				'mime'            => (string) $check['mime'],
				'kind'            => (string) $check['kind'],
				'size_bytes'      => $size,
				'sha256'          => (string) hash_file( 'sha256', $dest ),
				'width'           => (int) $check['width'],
				'height'          => (int) $check['height'],
				'status'          => 'pending',
				'created_at'      => Clock::mysql(),
			)
		);
		return self::get( $id ) ?? array();
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function get( int $id ): ?array {
		return Db::row( Db::prepare( 'SELECT * FROM {attachments} WHERE id = %d', $id ) );
	}

	/**
	 * @return array<string,mixed>|null
	 */
	public static function by_public_id( string $public_id ): ?array {
		return Db::row( Db::prepare( "SELECT * FROM {attachments} WHERE public_id = %s AND status <> 'deleted'", $public_id ) );
	}

	/**
	 * @param int[] $message_ids
	 * @return array<int,array<int,array<string,mixed>>> Keyed by message ID.
	 */
	public static function for_messages( array $message_ids ): array {
		if ( ! $message_ids ) {
			return array();
		}
		$rows = Db::rows( Db::prepare( "SELECT * FROM {attachments} WHERE status = 'ready' AND message_id IN (" . Db::in_ints( $message_ids ) . ') ORDER BY id ASC' ) );
		$out  = array();
		foreach ( $rows as $row ) {
			$out[ (int) $row['message_id'] ][] = $row;
		}
		return $out;
	}

	/**
	 * Resolves visitor-supplied public IDs to internal IDs the visitor owns
	 * and has not yet attached.
	 *
	 * @param string[] $public_ids
	 * @return int[]
	 * @throws DomainException When any ID is not owned.
	 */
	public static function resolve_owned( array $public_ids, int $conversation_id, int $visitor_id ): array {
		$public_ids = array_slice( array_unique( array_filter( array_map( 'strval', $public_ids ) ) ), 0, 5 );
		$ids        = array();
		foreach ( $public_ids as $pid ) {
			$row = self::by_public_id( $pid );
			if ( ! $row || (int) $row['conversation_id'] !== $conversation_id || 'visitor' !== $row['uploader_type'] || (int) $row['uploader_ref'] !== $visitor_id || null !== $row['message_id'] ) {
				throw new DomainException( 'attachment_not_found', __( 'Attachment not found.', 'televixo' ), 404 );
			}
			$ids[] = (int) $row['id'];
		}
		return $ids;
	}

	public static function delete_files_for_conversation( int $conversation_id ): void {
		foreach ( Db::rows( Db::prepare( 'SELECT * FROM {attachments} WHERE conversation_id = %d', $conversation_id ) ) as $row ) {
			$path = self::path_of( $row );
			if ( is_file( $path ) ) {
				wp_delete_file( $path );
			}
		}
	}

	/**
	 * Removes uploads never attached to a message after a day.
	 */
	public static function purge_orphans(): int {
		$rows = Db::rows( Db::prepare( "SELECT * FROM {attachments} WHERE status = 'pending' AND message_id IS NULL AND created_at < %s LIMIT 200", Clock::mysql( Clock::now() - DAY_IN_SECONDS ) ) );
		foreach ( $rows as $row ) {
			$path = self::path_of( $row );
			if ( is_file( $path ) ) {
				wp_delete_file( $path );
			}
			Db::exec( Db::prepare( 'DELETE FROM {attachments} WHERE id = %d', (int) $row['id'] ) );
		}
		return count( $rows );
	}

	/**
	 * Sends file bytes with safe headers. Images may be shown inline; every
	 * other type is forced to download. nosniff prevents content sniffing.
	 */
	public static function stream( array $attachment, bool $inline ): void {
		$path = self::path_of( $attachment );
		if ( ! is_file( $path ) ) {
			status_header( 404 );
			exit;
		}
		$inline = $inline && 'image' === $attachment['kind'];
		$name   = (string) $attachment['original_name'];
		$ascii  = preg_replace( '/[^A-Za-z0-9._-]/', '_', $name );
		nocache_headers();
		header( 'Content-Type: ' . $attachment['mime'] );
		header( 'Content-Length: ' . (int) filesize( $path ) );
		header( 'X-Content-Type-Options: nosniff' );
		header( "Content-Security-Policy: default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox" );
		header( 'Cross-Origin-Resource-Policy: same-origin' );
		header( 'Cache-Control: private, no-store' );
		header( sprintf( 'Content-Disposition: %s; filename="%s"; filename*=UTF-8\'\'%s', $inline ? 'inline' : 'attachment', $ascii, rawurlencode( $name ) ) );
		readfile( $path ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_readfile
		exit;
	}

	public static function error_text( string $code ): string {
		$map = array(
			'file_too_large'        => __( 'The file is too large.', 'televixo' ),
			'file_type_not_allowed' => __( 'This file type is not allowed.', 'televixo' ),
			'file_type_blocked'     => __( 'This file type is not allowed.', 'televixo' ),
			'file_content_mismatch' => __( 'The file content does not match its type.', 'televixo' ),
			'file_content_blocked'  => __( 'The file contains blocked content.', 'televixo' ),
			'image_invalid'         => __( 'The image could not be read.', 'televixo' ),
			'file_empty'            => __( 'The file is empty.', 'televixo' ),
		);
		return $map[ $code ] ?? __( 'The file could not be accepted.', 'televixo' );
	}
}
