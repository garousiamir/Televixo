<?php
// wp eval-file prepare.php — seeds one conversation and 10 operators, plus
// 40 visitor messages across 5 conversations for the worker race.
use Televixo\Persistence\Db;
use Televixo\Persistence\Schema;
foreach ( Schema::TABLES as $t ) { Db::wpdb()->query( 'DELETE FROM ' . Schema::table( $t ) ); } // phpcs:ignore
tvx_e2e_calls( true );
$ops = array();
for ( $i = 0; $i < 10; $i++ ) {
	$login = "race_op_$i";
	$u     = get_user_by( 'login', $login );
	$uid   = $u ? $u->ID : wp_insert_user( array( 'user_login' => $login, 'user_pass' => wp_generate_password(), 'role' => 'televixo_operator' ) );
	$ops[] = (int) \Televixo\Domain\Operators::for_user( (int) $uid )['id'];
}
$_SERVER['REMOTE_ADDR'] = '198.51.100.9';
$convs = array();
for ( $c = 0; $c < 5; $c++ ) {
	$_COOKIE = array();
	\Televixo\Security\SessionManager::reset_request_cache();
	$s       = \Televixo\Security\SessionManager::create();
	$conv    = \Televixo\Domain\Conversations::start( (int) $s['visitor_id'] );
	$convs[] = $conv['public_id'];
	for ( $m = 0; $m < 8; $m++ ) {
		\Televixo\Domain\Messages::create_visitor_message( \Televixo\Domain\Conversations::get( (int) $conv['id'] ), (int) $s['visitor_id'], "c$c m$m", "race-$c-$m-" . wp_generate_password( 8, false ) );
	}
}
update_option( 'tvx_race', array( 'ops' => $ops, 'claim' => $convs[0], 'convs' => $convs ), false );
echo wp_json_encode( array( 'ops' => count( $ops ), 'jobs' => (int) Db::var( Db::prepare( 'SELECT COUNT(*) FROM {outbox}' ) ) ) ), "\n";
