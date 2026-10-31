<?php
// wp eval-file work.php — a competing queue worker.
while ( microtime( true ) < (float) get_option( 'tvx_race_go', 0 ) ) { usleep( 500 ); }
$total = 0;
$end   = microtime( true ) + 25;
while ( microtime( true ) < $end ) {
	$s      = \Televixo\Queue\Worker::run( 2.0 );
	$total += $s['outbox'];
	$left   = (int) \Televixo\Persistence\Db::var( \Televixo\Persistence\Db::prepare( "SELECT COUNT(*) FROM {outbox} WHERE status IN ('pending','leased')" ) );
	if ( 0 === $left ) { break; }
	usleep( 50000 );
}
echo "processed=$total\n";
