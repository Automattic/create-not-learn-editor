<?php
/**
 * The Classic block's editor, for content written without blocks.
 *
 * Core's post editor loads TinyMCE and its settings for the Classic block
 * (`wp-admin/edit-form-blocks.php`). The block editor assets endpoint the
 * editor loads its blocks from leaves the block and TinyMCE out, so the
 * editor registers the block itself once those assets load, and asks this
 * route for TinyMCE the first time a Classic block shows. See
 * docs/editor-workarounds.md.
 *
 * @package CreateNotLearnEditor
 */

defined( 'ABSPATH' ) || exit;

/**
 * Register the Classic block hooks.
 */
function cnl_editor_register_classic_block_hooks() {
	add_action( 'rest_api_init', 'cnl_editor_register_classic_block_route' );
}

/**
 * Register the route the editor loads the Classic block's editor from.
 */
function cnl_editor_register_classic_block_route() {
	register_rest_route(
		CNL_EDITOR_REST_NAMESPACE,
		'/classic-block-assets',
		array(
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => 'cnl_editor_rest_get_classic_block_assets',
			'permission_callback' => static function () {
				return current_user_can( 'edit_posts' );
			},
		)
	);
}

/**
 * The scripts, styles and settings core's post editor prints for the Classic
 * block, as the HTML it prints them as.
 *
 * @return WP_REST_Response `{ html }`, to be added to the editor's page.
 */
function cnl_editor_rest_get_classic_block_assets() {
	return rest_ensure_response(
		array( 'html' => cnl_editor_get_classic_block_assets_html() )
	);
}

/**
 * Print what core's post editor does for the Classic block, and return it.
 *
 * `wpEditorL10n`, the settings the block passes to TinyMCE, comes from
 * `wp_tinymce_inline_scripts()`, which adds it ahead of `wp-block-library`.
 * The page already has that script, so it is printed on its own here.
 *
 * @global bool $concatenate_scripts
 *
 * @return string The HTML.
 */
function cnl_editor_get_classic_block_assets_html() {
	global $concatenate_scripts;

	if ( ! class_exists( '_WP_Editors', false ) ) {
		require ABSPATH . WPINC . '/class-wp-editor.php';
	}

	// Each script printed by itself, with its ID, so the page can skip the
	// ones it already has.
	$concatenate_scripts = false; // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited

	$scripts = wp_scripts();
	$before  = (array) $scripts->get_data( 'wp-block-library', 'before' );
	wp_tinymce_inline_scripts();
	$editor_settings = array_slice(
		(array) $scripts->get_data( 'wp-block-library', 'before' ),
		count( $before )
	);
	$scripts->add_data( 'wp-block-library', 'before', $before );

	wp_enqueue_editor();

	// Admin hooks for the page's head, which the editor's page has already
	// printed. This one also warns as deprecated.
	remove_action( 'wp_print_styles', 'print_emoji_styles' );

	ob_start();
	wp_print_inline_script_tag(
		implode( "\n", $editor_settings ),
		array( 'id' => 'cnl-classic-block-settings-js' )
	);
	wp_print_styles();
	wp_print_scripts();
	_WP_Editors::print_default_editor_scripts();

	return ob_get_clean();
}
