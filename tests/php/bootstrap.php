<?php
/**
 * PHPUnit bootstrap: loads the WordPress test suite and the plugin.
 */

$root = dirname( __DIR__, 2 );
require $root . '/vendor/yoast/phpunit-polyfills/phpunitpolyfills-autoload.php';
putenv( 'WP_PHPUNIT__TESTS_CONFIG=' . $root . '/tests/wp-tests-config.php' );
define( 'TELEVIXO_TESTING', true );

$tests_dir = getenv( 'WP_PHPUNIT__DIR' ) ?: $root . '/vendor/wp-phpunit/wp-phpunit';
require_once $tests_dir . '/includes/functions.php';

tests_add_filter(
	'muplugins_loaded',
	static function () use ( $root ) {
		require $root . '/televixo/televixo.php';
	}
);

require $tests_dir . '/includes/bootstrap.php';
require __DIR__ . '/Support/FakeTelegram.php';
require __DIR__ . '/Support/TestCase.php';
