<?php
/**
 * Rule schema validation and evaluation against shared vectors that the
 * widget's TypeScript evaluator also runs (tests/js/rules.test.mjs).
 */

namespace Televixo\Tests;

use Televixo\Rules\Engine;
use Televixo\Rules\Repository;
use Televixo\Rules\Schema;

final class RulesTest extends TestCase {

	public function test_shared_vectors(): void {
		$vectors = json_decode( (string) file_get_contents( dirname( __DIR__ ) . '/fixtures/rule-vectors.json' ), true );
		$n       = 0;
		foreach ( $vectors as $v ) {
			$valid = Schema::validate( $v['definition'] );
			$this->assertTrue( $valid['ok'], $v['name'] . ': ' . implode( '; ', $valid['errors'] ) );
			foreach ( $v['cases'] as $i => $case ) {
				$r = Engine::evaluate( $valid['definition'], $case['ctx'], (int) $v['id'] );
				$this->assertSame( $case['expected'], $r['matched'], $v['name'] . " case $i" );
				$this->assertNotEmpty( $r['trace'] );
				++$n;
			}
		}
		$this->assertGreaterThan( 20, $n );
	}

	public function test_resolution_precedence(): void {
		$fx    = json_decode( (string) file_get_contents( dirname( __DIR__ ) . '/fixtures/rule-resolution.json' ), true );
		$rules = array_map(
			static function ( $r ) {
				$r['definition'] = Schema::validate( $r['definition'] )['definition'];
				return $r;
			},
			$fx['rules']
		);
		foreach ( $fx['cases'] as $case ) {
			$res = Engine::resolve( $rules, $case['ctx'] );
			$att = $res['actions']['attention'] ?? null;
			$this->assertSame( $case['expected']['attention'], $att ? $att['type'] . ( isset( $att['text'] ) ? ':' . $att['text'] : '' ) : null );
			$this->assertSame( $case['expected']['launcher'], $res['actions']['launcher']['visible'] ?? true );
			$this->assertSame( $case['expected']['greeting'], $res['actions']['greeting']['text'] ?? null );
			$this->assertSame( $case['expected']['matched'], $res['matched'] );
		}
	}

	public function test_invalid_definitions_are_rejected(): void {
		$bad = array(
			array( 'conditions' => array( 'op' => 'and', 'items' => array( array( 'type' => 'eval', 'operator' => 'is' ) ) ), 'actions' => array( array( 'type' => 'open_chat' ) ) ),
			array( 'conditions' => array( 'op' => 'and', 'items' => array( array( 'type' => 'url', 'operator' => 'regex', 'value' => '.*' ) ) ), 'actions' => array( array( 'type' => 'open_chat' ) ) ),
			array( 'conditions' => array( 'op' => 'and', 'items' => array( array( 'type' => 'url', 'operator' => 'wildcard', 'value' => 'no-slash*' ) ) ), 'actions' => array( array( 'type' => 'open_chat' ) ) ),
			array( 'conditions' => array( 'op' => 'and', 'items' => array( array( 'type' => 'site' ) ) ), 'actions' => array() ),
			array( 'conditions' => array( 'op' => 'and', 'items' => array( array( 'items' => array( array( 'items' => array( array( 'items' => array( array( 'items' => array( array( 'type' => 'site' ) ) ) ) ) ) ) ) ) ) ), 'actions' => array( array( 'type' => 'open_chat' ) ) ),
		);
		foreach ( $bad as $i => $def ) {
			$this->assertFalse( Schema::validate( $def )['ok'], "bad[$i]" );
		}
		$xss = Schema::validate( array( 'conditions' => array( 'op' => 'and', 'items' => array( array( 'type' => 'site' ) ) ), 'actions' => array( array( 'type' => 'teaser', 'text' => '<script>alert(1)</script>Hi' ) ) ) );
		$this->assertStringNotContainsString( '<script>', $xss['definition']['actions'][0]['text'] );
	}

	public function test_import_export_round_trip_disables_by_default(): void {
		Repository::save( array( 'name' => 'A', 'status' => 'enabled', 'priority' => 5, 'definition' => array( 'conditions' => array( 'op' => 'and', 'items' => array( array( 'type' => 'site' ) ) ), 'actions' => array( array( 'type' => 'open_chat' ) ) ) ) );
		$export = Repository::export();
		$result = Repository::import( $export );
		$this->assertSame( 1, $result['imported'] );
		$all = Repository::all();
		$this->assertCount( 2, $all );
		$this->assertSame( 'disabled', $all[1]['status'] );
		$this->assertCount( 1, Repository::public_rules(), 'Only enabled rules ship to the widget' );
	}

	public function test_preview_endpoint_explains_matches(): void {
		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );
		$res = $this->rest(
			'POST',
			'/admin/rules/preview',
			array(
				'definition' => array( 'conditions' => array( 'op' => 'and', 'items' => array( array( 'type' => 'url', 'operator' => 'wildcard', 'value' => '/pricing*' ) ) ), 'actions' => array( array( 'type' => 'open_chat' ) ) ),
				'context'    => array( 'path' => '/pricing/pro' ),
			)
		);
		$data = $res->get_data();
		$this->assertSame( 200, $res->get_status() );
		$this->assertTrue( $data['explain'][0]['matched'] );
		$this->assertSame( '/pricing/pro', $data['explain'][0]['trace'][0]['actual'] );
	}
}
