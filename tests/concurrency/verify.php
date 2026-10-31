<?php
use Televixo\Persistence\Db;
$race   = get_option( 'tvx_race' );
$claim  = \Televixo\Domain\Conversations::by_public_id( $race['claim'] );
$calls  = array_values( array_filter( tvx_e2e_calls(), fn( $c ) => 'sendMessage' === $c['method'] ) );
$texts  = array_map( fn( $c ) => substr( $c['params']['text'], strrpos( $c['params']['text'], "\n" ) + 1 ), $calls );
$order  = array();
foreach ( $texts as $t ) { [ $c, $m ] = explode( ' ', $t ); $order[ $c ][] = (int) substr( $m, 1 ); }
$ordered = true;
foreach ( $order as $list ) { $sorted = $list; sort( $sorted ); $ordered = $ordered && $sorted === $list; }
echo wp_json_encode(
	array(
		'claim_assignments' => (int) Db::var( Db::prepare( 'SELECT COUNT(*) FROM {assignments} WHERE conversation_id = %d', (int) $claim['id'] ) ),
		'sent'              => count( $texts ),
		'unique_sent'       => count( array_unique( $texts ) ),
		'jobs_done'         => (int) Db::var( Db::prepare( "SELECT COUNT(*) FROM {outbox} WHERE status = 'done'" ) ),
		'per_conversation_order_preserved' => $ordered,
	)
), "\n";
