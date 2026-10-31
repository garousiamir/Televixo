<?php
/**
 * Allowlist sanitizer for small launcher icons.
 *
 * SVG uploads as chat attachments are refused entirely (FileInspector). This
 * sanitizer only accepts admin-pasted icon markup and reduces it to a fixed set
 * of drawing elements and presentation attributes: no scripts, event handlers,
 * external references, <foreignObject>, <use>, styles or entities.
 *
 * @package Televixo
 */

namespace Televixo\Security;

defined( 'ABSPATH' ) || exit;

final class SvgSanitizer {

	private const ELEMENTS = array( 'svg', 'g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon' );

	private const ATTRIBUTES = array(
		'viewbox', 'd', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height',
		'points', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'fill-rule',
		'clip-rule', 'opacity', 'fill-opacity', 'stroke-opacity', 'transform', 'xmlns',
	);

	public static function sanitize_icon( string $svg ): string {
		$svg = trim( $svg );
		if ( '' === $svg || strlen( $svg ) > 8192 ) {
			return '';
		}
		if ( preg_match( '/<!DOCTYPE|<!ENTITY|<\?/i', $svg ) ) {
			return '';
		}
		$prev = libxml_use_internal_errors( true );
		$doc  = new \DOMDocument();
		$ok   = $doc->loadXML( $svg, LIBXML_NONET | LIBXML_NOBLANKS );
		libxml_clear_errors();
		libxml_use_internal_errors( $prev );
		if ( ! $ok || ! $doc->documentElement || 'svg' !== strtolower( $doc->documentElement->localName ) ) {
			return '';
		}
		if ( ! self::clean( $doc->documentElement ) ) {
			return '';
		}
		$root = $doc->documentElement;
		$root->setAttribute( 'aria-hidden', 'true' );
		$root->setAttribute( 'focusable', 'false' );
		$out = $doc->saveXML( $root );
		return is_string( $out ) ? $out : '';
	}

	private static function clean( \DOMElement $el ): bool {
		if ( ! in_array( strtolower( $el->localName ), self::ELEMENTS, true ) ) {
			return false;
		}
		$remove = array();
		foreach ( $el->attributes as $attr ) {
			$name  = strtolower( $attr->nodeName );
			$value = (string) $attr->nodeValue;
			$allowed = in_array( $name, self::ATTRIBUTES, true )
				|| 'aria-hidden' === $name || 'focusable' === $name;
			if ( ! $allowed || preg_match( '/url\s*\(|javascript:|data:|&|expression/i', $value ) ) {
				$remove[] = $attr->nodeName;
			}
		}
		foreach ( $remove as $name ) {
			$el->removeAttribute( $name );
		}
		$children = array();
		foreach ( $el->childNodes as $child ) {
			$children[] = $child;
		}
		foreach ( $children as $child ) {
			if ( $child instanceof \DOMElement ) {
				if ( ! self::clean( $child ) ) {
					$el->removeChild( $child );
				}
			} elseif ( ! ( $child instanceof \DOMText && '' === trim( (string) $child->nodeValue ) ) ) {
				$el->removeChild( $child );
			}
		}
		return true;
	}
}
