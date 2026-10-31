<?php
/**
 * Server-side upload inspection. The browser-provided MIME type and file name
 * are never trusted: the type is detected from content with finfo, must match
 * an allowlisted extension, and executable or scriptable content is refused.
 *
 * @package Televixo
 */

namespace Televixo\Security;

defined( 'ABSPATH' ) || exit;

final class FileInspector {

	/**
	 * Allowed extension => accepted detected MIME types and attachment kind.
	 */
	public const ALLOWED = array(
		'jpg'  => array( 'mimes' => array( 'image/jpeg' ), 'kind' => 'image' ),
		'png'  => array( 'mimes' => array( 'image/png' ), 'kind' => 'image' ),
		'gif'  => array( 'mimes' => array( 'image/gif' ), 'kind' => 'image' ),
		'webp' => array( 'mimes' => array( 'image/webp' ), 'kind' => 'image' ),
		'pdf'  => array( 'mimes' => array( 'application/pdf' ), 'kind' => 'file' ),
		'txt'  => array( 'mimes' => array( 'text/plain' ), 'kind' => 'file' ),
		'csv'  => array( 'mimes' => array( 'text/plain', 'text/csv' ), 'kind' => 'file' ),
		'docx' => array( 'mimes' => array( 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip' ), 'kind' => 'file' ),
		'xlsx' => array( 'mimes' => array( 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip' ), 'kind' => 'file' ),
		'ogg'  => array( 'mimes' => array( 'audio/ogg', 'application/ogg', 'video/ogg' ), 'kind' => 'voice' ),
		'mp3'  => array( 'mimes' => array( 'audio/mpeg' ), 'kind' => 'voice' ),
		'm4a'  => array( 'mimes' => array( 'audio/mp4', 'audio/x-m4a', 'video/mp4' ), 'kind' => 'voice' ),
	);

	private const DENY_EXT = '/\.(php\d?|phtml|phar|pht|shtml|cgi|pl|py|rb|sh|bash|exe|dll|bat|cmd|com|msi|js|mjs|jsp|asp|aspx|htaccess|htm|html|xhtml|svg|svgz|xml|swf|jar|vbs|ps1|hta|scr)(\.|$)/i';

	/**
	 * @param string   $path      Temporary file path.
	 * @param string   $client_name Original name supplied by the client.
	 * @param string[] $enabled   Enabled extensions.
	 * @return array{ok:bool,error?:string,ext?:string,mime?:string,kind?:string,width?:int,height?:int,name?:string}
	 */
	public static function inspect( string $path, string $client_name, array $enabled, int $max_bytes ): array {
		if ( ! is_file( $path ) || ! is_readable( $path ) ) {
			return array( 'ok' => false, 'error' => 'file_unreadable' );
		}
		$size = (int) filesize( $path );
		if ( $size <= 0 ) {
			return array( 'ok' => false, 'error' => 'file_empty' );
		}
		if ( $size > $max_bytes ) {
			return array( 'ok' => false, 'error' => 'file_too_large' );
		}
		$name = self::safe_name( $client_name );
		if ( preg_match( self::DENY_EXT, $client_name ) ) {
			return array( 'ok' => false, 'error' => 'file_type_blocked' );
		}
		$ext = strtolower( (string) pathinfo( $name, PATHINFO_EXTENSION ) );
		if ( 'jpeg' === $ext ) {
			$ext = 'jpg';
		}
		if ( ! isset( self::ALLOWED[ $ext ] ) || ! in_array( $ext, $enabled, true ) ) {
			return array( 'ok' => false, 'error' => 'file_type_not_allowed' );
		}
		$finfo = new \finfo( FILEINFO_MIME_TYPE );
		$mime  = (string) $finfo->file( $path );
		if ( ! in_array( $mime, self::ALLOWED[ $ext ]['mimes'], true ) ) {
			return array( 'ok' => false, 'error' => 'file_content_mismatch' );
		}
		$head = (string) file_get_contents( $path, false, null, 0, 4096 );
		if ( preg_match( '/<\?php|<script|<svg|<html|<!DOCTYPE html|<iframe|^#!/i', $head ) ) {
			return array( 'ok' => false, 'error' => 'file_content_blocked' );
		}
		$width  = 0;
		$height = 0;
		if ( 'image' === self::ALLOWED[ $ext ]['kind'] ) {
			$dims = @getimagesize( $path ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged -- invalid images return false.
			if ( ! $dims || $dims[0] < 1 || $dims[1] < 1 || $dims[0] * $dims[1] > 40000000 ) {
				return array( 'ok' => false, 'error' => 'image_invalid' );
			}
			$width  = (int) $dims[0];
			$height = (int) $dims[1];
		}
		if ( in_array( $ext, array( 'docx', 'xlsx' ), true ) && ! self::is_office_zip( $path ) ) {
			return array( 'ok' => false, 'error' => 'file_content_mismatch' );
		}
		return array(
			'ok'     => true,
			'ext'    => $ext,
			'mime'   => 'application/zip' === $mime ? ( 'docx' === $ext ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ) : $mime,
			'kind'   => self::ALLOWED[ $ext ]['kind'],
			'width'  => $width,
			'height' => $height,
			'name'   => $name,
		);
	}

	public static function safe_name( string $name ): string {
		$name = wp_basename( str_replace( '\\', '/', $name ) );
		$name = preg_replace( '/[^\p{L}\p{N}._ -]+/u', '_', $name ) ?? 'file';
		$name = trim( $name, ". \t\n\r\0\x0B" );
		if ( '' === $name ) {
			$name = 'file';
		}
		return mb_substr( $name, -120 );
	}

	private static function is_office_zip( string $path ): bool {
		if ( ! class_exists( '\ZipArchive' ) ) {
			return true; // finfo already confirmed a zip container; macros are not executed server-side.
		}
		$zip = new \ZipArchive();
		if ( true !== $zip->open( $path, \ZipArchive::RDONLY ) ) {
			return false;
		}
		$ok = false !== $zip->locateName( '[Content_Types].xml' );
		for ( $i = 0; $ok && $i < $zip->numFiles; $i++ ) {
			$entry = (string) $zip->getNameIndex( $i );
			if ( preg_match( '/vbaProject\.bin$|\.(exe|dll|js|php)$/i', $entry ) ) {
				$ok = false;
			}
		}
		$zip->close();
		return $ok;
	}
}
