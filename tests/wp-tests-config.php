<?php
/**
 * WordPress test-suite configuration. Values come from the environment so
 * CI and local runs can point at their own WordPress checkout and database.
 */
define( 'ABSPATH', rtrim( getenv( 'WP_CORE_DIR' ) ?: '/tmp/wordpress', '/' ) . '/' );
define( 'DB_NAME', getenv( 'WP_TESTS_DB_NAME' ) ?: 'televixo_tests' );
define( 'DB_USER', getenv( 'WP_TESTS_DB_USER' ) ?: 'tvx' );
define( 'DB_PASSWORD', getenv( 'WP_TESTS_DB_PASSWORD' ) ?: 'tvx' );
define( 'DB_HOST', getenv( 'WP_TESTS_DB_HOST' ) ?: 'localhost' );
define( 'DB_CHARSET', 'utf8mb4' );
define( 'DB_COLLATE', '' );
$table_prefix = 'wptests_';
define( 'WP_TESTS_DOMAIN', 'example.org' );
define( 'WP_TESTS_EMAIL', 'admin@example.org' );
define( 'WP_TESTS_TITLE', 'Televixo Tests' );
define( 'WP_PHP_BINARY', 'php' );
define( 'WPLANG', '' );
define( 'WP_DEBUG', true );
define( 'AUTH_KEY', 'test-auth-key-0123456789abcdefghijklmnopqrstuvwxyz' );
define( 'SECURE_AUTH_KEY', 'test-secure-auth-key-0123456789abcdefghijklmnopqrstuv' );
