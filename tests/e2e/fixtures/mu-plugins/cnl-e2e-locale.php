<?php
/**
 * Plugin Name: Create Not Learn e2e test locale
 * Description: Only on the wp-env tests site. Switches a request to German when it carries the `cnl_e2e_locale` cookie, and reads the editor's German translations from the fixture beside this file, so a spec can check the editor's strings are translated.
 *
 * @package create-not-learn-editor
 */

defined( 'ABSPATH' ) || exit;

if ( isset( $_COOKIE['cnl_e2e_locale'] ) && 'de_DE' === $_COOKIE['cnl_e2e_locale'] ) {
	add_filter(
		'determine_locale',
		static function () {
			return 'de_DE';
		}
	);

	// Stands in for the language pack WordPress would put in
	// `wp-content/languages/plugins`, with the same file names.
	add_filter(
		'lang_dir_for_domain',
		static function ( $path, $domain ) {
			return 'create-not-learn-editor' === $domain
				? __DIR__ . '/cnl-e2e-languages/'
				: $path;
		},
		10,
		2
	);
}
