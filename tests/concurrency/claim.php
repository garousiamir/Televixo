<?php
// wp eval-file claim.php <index> — one process per operator, all claiming at once.
$race = get_option( 'tvx_race' );
$i    = (int) ( $args[0] ?? 0 );
$op   = \Televixo\Domain\Operators::get( $race['ops'][ $i ] );
while ( microtime( true ) < (float) get_option( 'tvx_race_go', 0 ) ) { usleep( 500 ); }
try {
	\Televixo\Domain\Assignment::claim( \Televixo\Domain\Conversations::by_public_id( $race['claim'] ), $op );
	echo "won\n";
} catch ( \Televixo\Domain\DomainException $e ) {
	echo $e->error_code, "\n";
}
