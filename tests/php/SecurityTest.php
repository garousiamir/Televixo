<?php
/**
 * Sessions, CSRF, IDOR, uploads, SVG, XSS storage, SSRF and redaction.
 */

namespace Televixo\Tests;

use Televixo\Core\Clock;
use Televixo\Domain\Attachments;
use Televixo\Domain\DomainException;
use Televixo\Persistence\Db;
use Televixo\Security\FileInspector;
use Televixo\Security\Redactor;
use Televixo\Security\Secrets;
use Televixo\Security\SessionManager;
use Televixo\Security\SvgSanitizer;

final class SecurityTest extends TestCase {

	private function fixture( string $name ): string {
		$tmp = wp_tempnam( $name );
		copy( dirname( __DIR__ ) . '/fixtures/files/' . $name, $tmp );
		return $tmp;
	}

	public function test_session_token_is_hashed_and_csrf_required(): void {
		$s   = $this->new_visitor_session();
		$raw = Db::row( Db::prepare( 'SELECT * FROM {sessions} WHERE id = %d', (int) $s['id'] ) );
		$this->assertSame( 64, strlen( $raw['token_hash'] ) );
		$this->assertStringNotContainsString( $s['token'], wp_json_encode( $raw ) );
		$this->assertSame( 43, strlen( $s['token'] ), '256-bit token' );

		$this->use_session( $s );
		$this->assertSame( 403, $this->rest( 'POST', '/conversations', array() )->get_status(), 'Missing CSRF header' );
		$this->assertSame( 403, $this->rest( 'POST', '/conversations', array(), array( 'X-Televixo-CSRF' => 'nope' ) )->get_status() );
		$this->assertSame( 200, $this->rest( 'POST', '/conversations', array(), $this->csrf( $s ) )->get_status() );
	}

	public function test_expired_and_revoked_sessions_are_rejected(): void {
		$s = $this->new_visitor_session();
		$c = $this->start_conversation( $s );
		Clock::freeze( time() + SessionManager::TTL + 10 );
		$this->use_session( $s );
		$this->assertSame( 401, $this->rest( 'GET', "/conversations/{$c['public_id']}/messages" )->get_status() );
		Clock::freeze( null );
		$this->use_session( $s );
		$this->assertSame( 200, $this->rest( 'DELETE', '/session', array(), $this->csrf( $s ) )->get_status() );
		$this->use_session( $s );
		$this->assertSame( 401, $this->rest( 'GET', "/conversations/{$c['public_id']}/messages" )->get_status() );
	}

	public function test_session_bound_to_wp_user_is_not_reused_after_logout_or_by_other_user(): void {
		$u1 = self::factory()->user->create();
		wp_set_current_user( $u1 );
		$s = $this->new_visitor_session();
		wp_set_current_user( 0 );
		$this->use_session( $s );
		$this->assertNull( SessionManager::current(), 'Logged-out browser cannot use the logged-in session' );
		$u2 = self::factory()->user->create();
		wp_set_current_user( $u2 );
		$this->use_session( $s );
		$this->assertNull( SessionManager::current() );
		wp_set_current_user( $u1 );
		$this->use_session( $s );
		$this->assertNotNull( SessionManager::current() );
	}

	public function test_session_creation_requires_json_and_is_rate_limited(): void {
		$req = new \WP_REST_Request( 'POST', '/televixo/v1/session' );
		$req->set_header( 'Content-Type', 'application/x-www-form-urlencoded' );
		$this->assertSame( 415, rest_get_server()->dispatch( $req )->get_status() );
		\Televixo\Core\Settings::update( array( 'limits' => array( 'sessions_per_hour' => 3 ) ) );
		$_SERVER['REMOTE_ADDR'] = '192.0.2.77';
		$codes = array();
		for ( $i = 0; $i < 5; $i++ ) {
			$_COOKIE = array();
			SessionManager::reset_request_cache();
			$codes[] = $this->rest( 'POST', '/session', array( 'x' => 1 ) )->get_status();
		}
		$this->assertSame( array( 200, 200, 200, 429, 429 ), $codes );
	}

	public function test_message_rate_limit(): void {
		\Televixo\Core\Settings::update( array( 'limits' => array( 'messages_per_minute' => 3 ) ) );
		$s = $this->new_visitor_session();
		$c = $this->start_conversation( $s );
		$codes = array();
		for ( $i = 0; $i < 5; $i++ ) {
			$codes[] = $this->visitor_sends( $s, $c['public_id'], "m$i" )->get_status();
		}
		$this->assertSame( array( 201, 201, 201, 429, 429 ), $codes );
	}

	public function test_cross_session_file_access_is_denied(): void {
		$a  = $this->new_visitor_session();
		$ca = $this->start_conversation( $a );
		$att = Attachments::store( $ca, $this->fixture( 'ok.png' ), 'ok.png', 'visitor', (int) $a['visitor_id'], false );
		$b  = $this->new_visitor_session();
		$this->use_session( $b );
		$this->assertSame( 404, $this->rest( 'GET', '/attachments/' . $att['public_id'] )->get_status() );
		$cb = $this->start_conversation( $b );
		// B cannot attach A's upload to B's own message either.
		$this->use_session( $b );
		$res = $this->rest( 'POST', "/conversations/{$cb['public_id']}/messages", array( 'body' => 'x', 'client_id' => 'abcdefgh1', 'attachments' => array( $att['public_id'] ) ), $this->csrf( $b ) );
		$this->assertSame( 404, $res->get_status() );
		// Bytes are stored under a random .bin name, not the client name.
		$this->assertMatchesRegularExpression( '/^[a-f0-9]{40}\.bin$/', $att['storage_name'] );
		$this->assertFileExists( Attachments::storage_dir() . '/.htaccess' );
	}

	/**
	 * @dataProvider hostile_files
	 */
	public function test_hostile_files_are_refused( string $file, string $name, string $code ): void {
		$r = FileInspector::inspect( $this->fixture( $file ), $name, array( 'jpg', 'png', 'pdf', 'txt' ), 10 * MB_IN_BYTES );
		$this->assertFalse( $r['ok'] );
		$this->assertSame( $code, $r['error'] );
	}

	public static function hostile_files(): array {
		return array(
			'php renamed jpg'   => array( 'php-as.jpg', 'photo.jpg', 'file_content_mismatch' ),
			'png+php polyglot'  => array( 'polyglot.png', 'x.png', 'file_content_blocked' ),
			'svg'               => array( 'evil.svg', 'evil.svg', 'file_type_blocked' ),
			'double extension'  => array( 'ok.png', 'shell.php.png', 'file_type_blocked' ),
			'html in txt'       => array( 'page.txt', 'page.txt', 'file_content_mismatch' ),
			'disabled type'     => array( 'doc.pdf', 'doc.docx', 'file_type_not_allowed' ),
		);
	}

	public function test_good_files_are_accepted(): void {
		$this->assertTrue( FileInspector::inspect( $this->fixture( 'ok.png' ), 'ok.png', array( 'png' ), MB_IN_BYTES )['ok'] );
		$this->assertTrue( FileInspector::inspect( $this->fixture( 'notes.txt' ), 'notes.txt', array( 'txt' ), MB_IN_BYTES )['ok'] );
		$this->assertFalse( FileInspector::inspect( $this->fixture( 'notes.txt' ), 'notes.txt', array( 'txt' ), 5 )['ok'], 'Size limit enforced' );
		$this->assertSame( 'a_b_.png', FileInspector::safe_name( '../../a<b>.png' ) );
	}

	public function test_svg_icon_sanitizer(): void {
		$clean = SvgSanitizer::sanitize_icon( '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" onload="alert(1)"><script>alert(1)</script><path d="M1 1h2" onclick="x()" fill="url(javascript:alert(1))"/><foreignObject><div>x</div></foreignObject><use href="#a"/></svg>' );
		$this->assertStringContainsString( '<path d="M1 1h2"', $clean );
		foreach ( array( 'onload', 'script', 'onclick', 'javascript', 'foreignObject', '<use' ) as $bad ) {
			$this->assertStringNotContainsString( $bad, $clean );
		}
		$this->assertSame( '', SvgSanitizer::sanitize_icon( '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg>&x;</svg>' ) );
		$this->assertSame( '', SvgSanitizer::sanitize_icon( '<div>not svg</div>' ) );
	}

	public function test_stored_xss_is_kept_as_text(): void {
		$this->configure_telegram();
		$s = $this->new_visitor_session();
		$c = $this->start_conversation( $s );
		$payload = '<img src=x onerror=alert(1)><script>alert(2)</script>';
		$this->visitor_sends( $s, $c['public_id'], $payload );
		$this->use_session( $s );
		$items = $this->rest( 'GET', "/conversations/{$c['public_id']}/messages" )->get_data()['items'];
		// The API returns the literal text; the widget renders it with textContent.
		$this->assertSame( $payload, $items[0]['body'] );
		$this->run_worker();
		$this->assertArrayNotHasKey( 'parse_mode', $this->tg->sent()[0] );
	}

	public function test_secrets_encrypted_at_rest_and_rotatable(): void {
		Secrets::set( 'bot_token', FakeTelegram::TOKEN );
		$raw = (string) wp_json_encode( get_option( Secrets::OPTION ) );
		$this->assertStringNotContainsString( FakeTelegram::TOKEN, $raw );
		$this->assertStringContainsString( 'tvx1:', $raw );
		$this->assertSame( FakeTelegram::TOKEN, Secrets::get( 'bot_token' ) );
		$tampered = get_option( Secrets::OPTION );
		$tampered['bot_token'] = substr( $tampered['bot_token'], 0, -4 ) . 'AAAA';
		update_option( Secrets::OPTION, $tampered );
		$this->assertSame( '', Secrets::get( 'bot_token' ), 'Authenticated encryption rejects tampering' );
		$this->assertSame( array( 'bot_token' ), Secrets::undecryptable() );
	}

	public function test_redaction_and_no_custom_api_host(): void {
		Secrets::set( 'bot_token', FakeTelegram::TOKEN );
		$this->assertStringNotContainsString( FakeTelegram::TOKEN, Redactor::text( 'cURL error for https://api.telegram.org/bot' . FakeTelegram::TOKEN . '/sendMessage' ) );
		$api = new \Televixo\Telegram\BotApi( FakeTelegram::TOKEN );
		$this->assertNull( $api->download( '../../etc/passwd', 100 ) );
		$this->assertNull( $api->download( 'https://evil.example/x', 100 ) );
		$this->assertSame( 'api.telegram.org', \Televixo\Telegram\BotApi::HOST );
	}

	public function test_oversize_json_body_rejected(): void {
		$s = $this->new_visitor_session();
		$c = $this->start_conversation( $s );
		$this->use_session( $s );
		$res = $this->rest( 'POST', "/conversations/{$c['public_id']}/messages", array( 'body' => str_repeat( 'a', 70000 ), 'client_id' => 'abcdefgh12' ), $this->csrf( $s ) );
		$this->assertSame( 413, $res->get_status() );
	}

	public function test_blocked_visitor_and_network(): void {
		$s = $this->new_visitor_session();
		$c = $this->start_conversation( $s );
		\Televixo\Domain\Visitors::block( (int) $s['visitor_id'], 'abuse', true, 'user', '1' );
		$this->use_session( $s );
		$this->assertSame( 401, $this->rest( 'GET', "/conversations/{$c['public_id']}/messages" )->get_status(), 'Sessions revoked on block' );
		$_COOKIE = array();
		SessionManager::reset_request_cache();
		$_SERVER['REMOTE_ADDR'] = Db::var( Db::prepare( 'SELECT 1' ) ) ? $_SERVER['REMOTE_ADDR'] : '';
		$net_visitor = Db::row( Db::prepare( 'SELECT network_hash FROM {visitors} WHERE id = %d', (int) $s['visitor_id'] ) );
		$this->assertTrue( \Televixo\Domain\Visitors::network_blocked( $net_visitor['network_hash'] ) );
	}

	public function test_forwarded_ip_ignored_unless_trusted_proxy(): void {
		$_SERVER['REMOTE_ADDR']          = '10.0.0.5';
		$_SERVER['HTTP_X_FORWARDED_FOR'] = '1.2.3.4';
		$this->assertSame( '10.0.0.5', \Televixo\Security\ClientIp::resolve() );
		\Televixo\Core\Settings::update( array( 'privacy' => array( 'trusted_proxies' => array( '10.0.0.0/8' ) ) ) );
		$this->assertSame( '1.2.3.4', \Televixo\Security\ClientIp::resolve() );
		$_SERVER['HTTP_X_FORWARDED_FOR'] = '1.2.3.4, 10.0.0.9';
		$this->assertSame( '1.2.3.4', \Televixo\Security\ClientIp::resolve() );
		unset( $_SERVER['HTTP_X_FORWARDED_FOR'] );
	}

	public function test_internal_notes_never_reach_visitor_routes(): void {
		$op = $this->operator();
		$s  = $this->new_visitor_session();
		$c  = $this->start_conversation( $s );
		\Televixo\Domain\Messages::create_note( $c, $op, 'SECRET-NOTE', 'admin' );
		$this->use_session( $s );
		foreach ( array( "/conversations/{$c['public_id']}/messages", "/conversations/{$c['public_id']}/updates" ) as $route ) {
			$this->assertStringNotContainsString( 'SECRET-NOTE', wp_json_encode( $this->rest( 'GET', $route )->get_data() ) );
		}
		$this->assertStringNotContainsString( 'SECRET-NOTE', \Televixo\Privacy\Transcript::build( $c ) );
	}
}
