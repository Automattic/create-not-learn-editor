<?php
/**
 * Plugin Name: CnL Plugin UI Fixture
 * Description: Registers editor UI in every plugin slot, for the Create Not Learn editor's plugin UI tests and spike. Not for production.
 * Version: 0.1.0
 * Requires Plugins: gutenberg
 *
 * Each `registerPlugin()` in `fixture.js` stands for one realistic plugin.
 * The `cnl_plugin_ui_fixture_only` option, a comma-separated list of their
 * names, limits which register, so a test can look at one plugin or none.
 *
 * @package CnLPluginUiFixture
 */

defined( 'ABSPATH' ) || exit;

add_action( 'enqueue_block_editor_assets', 'cnl_plugin_ui_fixture_enqueue' );
add_action( 'init', 'cnl_plugin_ui_fixture_register_meta' );
add_action( 'add_meta_boxes', 'cnl_plugin_ui_fixture_add_meta_box' );

/**
 * Enqueue the fixture's editor script.
 */
function cnl_plugin_ui_fixture_enqueue() {
	wp_enqueue_script(
		'cnl-plugin-ui-fixture',
		plugins_url( 'fixture.js', __FILE__ ),
		array(
			'wp-block-editor',
			'wp-commands',
			'wp-components',
			'wp-compose',
			'wp-core-data',
			'wp-data',
			'wp-editor',
			'wp-element',
			'wp-hooks',
			'wp-i18n',
			'wp-notices',
			'wp-plugins',
		),
		filemtime( __DIR__ . '/fixture.js' ),
		true
	);

	wp_enqueue_script(
		'cnl-plugin-ui-fixture-legacy',
		plugins_url( 'fixture-legacy.js', __FILE__ ),
		array( 'cnl-plugin-ui-fixture', 'wp-edit-post', 'wp-edit-site' ),
		filemtime( __DIR__ . '/fixture-legacy.js' ),
		true
	);

	$only = (string) get_option( 'cnl_plugin_ui_fixture_only', '' );

	wp_add_inline_script(
		'cnl-plugin-ui-fixture',
		sprintf(
			'window.cnlPluginUiFixture = %s;',
			wp_json_encode(
				array(
					'only' => '' === $only ? null : array_map( 'trim', explode( ',', $only ) ),
				)
			)
		),
		'before'
	);
}

/**
 * Post meta the social fixture's pre-publish panel writes, so what it asks
 * for is saved with the post, as Jetpack Social's message is.
 */
function cnl_plugin_ui_fixture_register_meta() {
	foreach ( array( 'post', 'page' ) as $post_type ) {
		register_post_meta(
			$post_type,
			'cnl_fixture_share_message',
			array(
				'show_in_rest'  => true,
				'single'        => true,
				'type'          => 'string',
				'auth_callback' => static function () {
					return current_user_can( 'edit_posts' );
				},
			)
		);
	}
}

/**
 * A classic meta box on posts, which only the full editor shows.
 */
function cnl_plugin_ui_fixture_add_meta_box() {
	add_meta_box(
		'cnl-fixture-legacy-fields',
		'Legacy custom fields',
		static function () {
			echo '<p>A classic meta box from the CnL plugin UI fixture.</p>';
		},
		'post',
		'normal'
	);
}
