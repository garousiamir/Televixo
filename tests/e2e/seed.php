<?php
/**
 * Seeds the throwaway E2E site (run with: wp eval-file tests/e2e/seed.php).
 */
use Televixo\Core\Settings;
use Televixo\Persistence\Db;
use Televixo\Persistence\Schema;
use Televixo\Security\Secrets;

foreach ( Schema::TABLES as $t ) {
	Db::wpdb()->query( 'DELETE FROM ' . Schema::table( $t ) ); // phpcs:ignore
}
delete_option( 'tvx_e2e_calls' );
delete_option( Settings::OPTION );
Settings::flush();
Secrets::set( 'bot_token', '123456789:AAHe2eFakeTokenForBrowserTests_abcdef' );
Secrets::set( 'webhook_secret', 'e2e-secret-123' );
Settings::set_internal( 'telegram.bot_id', '123456789' );
Settings::set_internal( 'telegram.bot_username', 'chio_care_bot' );
Settings::set_internal( 'telegram.destination_chat_id', '-1001000000001' );
Settings::update(
	array(
		'widget'  => array(
			'title'          => 'Chio care',
			'subtitle'       => 'Clara usually replies in minutes',
			'greeting'       => 'Hi! I’m Clara from the Chio studio. Looking for a size, an order update or something else?',
			'suggestions'    => array( 'Where is my order?', 'Which size am I?', 'Start a return' ),
			'excluded_paths' => "/no-chat*",
			'label'          => 'Chat with us',
			'sound'          => true,
		),
		'uploads' => array( 'types' => array( 'jpg', 'png', 'pdf', 'txt' ) ),
	)
);
foreach ( array( 'pricing' => 'Pricing', 'about' => 'About', 'no-chat' => 'No chat here' ) as $slug => $title ) {
	if ( ! get_page_by_path( $slug ) ) {
		wp_insert_post( array( 'post_type' => 'page', 'post_status' => 'publish', 'post_name' => $slug, 'post_title' => $title, 'post_content' => str_repeat( "<p>$title content paragraph.</p>", 40 ) ) );
	}
}
$admin = get_user_by( 'login', 'admin' );
$op    = \Televixo\Domain\Operators::for_user( (int) $admin->ID );
Db::update( 'operators', array( 'telegram_user_id' => '777', 'display_name' => 'Clara' ), array( 'id' => (int) $op['id'] ) );
\Televixo\Domain\Operators::set_availability( (int) $op['id'], 'online', time() + 8 * HOUR_IN_SECONDS );
\Televixo\Rules\Repository::save(
	array(
		'name'       => 'Pricing nudge',
		'status'     => 'enabled',
		'priority'   => 50,
		'definition' => array(
			'conditions' => array( 'op' => 'and', 'items' => array(
				array( 'type' => 'url', 'operator' => 'wildcard', 'value' => '/pricing*' ),
				array( 'type' => 'time_on_page', 'operator' => 'gte', 'value' => 15 ),
				array( 'type' => 'chat_opened', 'operator' => 'is', 'value' => false ),
				array( 'type' => 'trigger_seen', 'operator' => 'not_within_hours', 'value' => array( 'rule' => 0, 'hours' => 24 ) ),
			) ),
			'actions'    => array( array( 'type' => 'teaser', 'text' => 'Questions about our plans? We reply in minutes.' ) ),
			'frequency'  => array( 'per_page' => 1, 'per_visitor' => null, 'cooldown_hours' => 24 ),
		),
	)
);
echo "seeded\n";
