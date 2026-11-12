<?php
/**
 * Boots the WordPress test suite with Gutenberg and this plugin active.
 *
 * Runs inside wp-env's tests-cli container, which sets WP_TESTS_DIR. See
 * `npm run test:php` in CONTRIBUTING.md.
 *
 * @package CreateNotLearnEditor
 */

$cnl_tests_dir = getenv( 'WP_TESTS_DIR' );
if ( ! $cnl_tests_dir ) {
	$cnl_tests_dir = '/wordpress-phpunit';
}

if ( ! file_exists( $cnl_tests_dir . '/includes/functions.php' ) ) {
	fwrite( STDERR, "Can't find the WordPress test suite in {$cnl_tests_dir}. Run the tests with `npm run test:php`.\n" );
	exit( 1 );
}

require_once dirname( __DIR__, 2 ) . '/vendor/yoast/phpunit-polyfills/phpunitpolyfills-autoload.php';
require_once $cnl_tests_dir . '/includes/functions.php';

// The plugin requires Gutenberg, so it loads first, as WordPress would load it.
tests_add_filter(
	'muplugins_loaded',
	static function () {
		require WP_PLUGIN_DIR . '/gutenberg/gutenberg.php';
		require dirname( __DIR__, 2 ) . '/create-not-learn-editor.php';
	}
);

require $cnl_tests_dir . '/includes/bootstrap.php';
