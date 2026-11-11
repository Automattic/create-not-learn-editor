<?php
/**
 * Plugin Name: Create Not Learn Editor
 * Description: A standalone experimental site editor built on released WordPress and Gutenberg editor packages.
 * Version: 0.4.0
 * Requires at least: 7.0
 * Requires PHP: 7.4
 * Requires Plugins: gutenberg
 * Author: Create Not Learn
 * Text Domain: create-not-learn-editor
 * Update URI: false
 *
 * @package CreateNotLearnEditor
 */

defined( 'ABSPATH' ) || exit;

define( 'CNL_EDITOR_VERSION', '0.4.0' );
define( 'CNL_EDITOR_MIN_GUTENBERG_VERSION', '24.0.0' );
define( 'CNL_EDITOR_FILE', __FILE__ );
define( 'CNL_EDITOR_PATH', plugin_dir_path( __FILE__ ) );
define( 'CNL_EDITOR_URL', plugin_dir_url( __FILE__ ) );
define( 'CNL_EDITOR_SLUG', 'create-not-learn-editor' );
define( 'CNL_EDITOR_REST_NAMESPACE', 'create-not-learn-editor/v1' );

/*
 * Visual theme layered on top of the WordPress Design System.
 *
 * 'default' is stock WPDS; 'modern' softens corners and surfaces. Override
 * it in wp-config.php, or with the `create-not-learn-editor_ui_theme` filter.
 */
if ( ! defined( 'CNL_EDITOR_UI_THEME' ) ) {
	define( 'CNL_EDITOR_UI_THEME', 'default' );
}

require_once CNL_EDITOR_PATH . 'includes/dependencies.php';

add_action( 'admin_notices', 'cnl_editor_render_dependency_notice' );
add_action( 'plugins_loaded', 'cnl_editor_bootstrap', 20 );

/**
 * Bootstrap the plugin after all active plugins have loaded.
 */
function cnl_editor_bootstrap() {
	if ( ! cnl_editor_is_gutenberg_ready() ) {
		return;
	}

	require_once CNL_EDITOR_PATH . 'includes/content-types.php';
	require_once CNL_EDITOR_PATH . 'includes/block-templates.php';
	require_once CNL_EDITOR_PATH . 'includes/setup-defaults.php';
	require_once CNL_EDITOR_PATH . 'includes/preview-context.php';
	require_once CNL_EDITOR_PATH . 'includes/preview-frame.php';
	require_once CNL_EDITOR_PATH . 'includes/site-overview.php';
	require_once CNL_EDITOR_PATH . 'includes/rest-api.php';
	require_once CNL_EDITOR_PATH . 'includes/admin-bar.php';
	require_once CNL_EDITOR_PATH . 'includes/shop.php';
	require_once CNL_EDITOR_PATH . 'includes/blog-admin.php';
	require_once CNL_EDITOR_PATH . 'includes/editor-registry.php';
	require_once CNL_EDITOR_PATH . 'includes/app-settings.php';
	require_once CNL_EDITOR_PATH . 'includes/editor-assets.php';
	require_once CNL_EDITOR_PATH . 'includes/admin-page.php';
	require_once CNL_EDITOR_PATH . 'includes/media.php';
	require_once CNL_EDITOR_PATH . 'includes/gutenberg-routes.php';
	require_once CNL_EDITOR_PATH . 'includes/block-canvas-styles.php';
	require_once CNL_EDITOR_PATH . 'includes/layouts.php';
	require_once CNL_EDITOR_PATH . 'includes/plugin-compat.php';
	require_once CNL_EDITOR_PATH . 'includes/post-kinds.php';
	require_once CNL_EDITOR_PATH . 'includes/page-list.php';

	cnl_editor_register_content_type_hooks();
	cnl_editor_register_shop_hooks();
	cnl_editor_register_preview_frame_hooks();
	cnl_editor_register_block_template_hooks();
	cnl_editor_register_rest_hooks();
	cnl_editor_register_editor_registry_hooks();
	cnl_editor_register_admin_page_hooks();
	cnl_editor_register_editor_asset_hooks();
	cnl_editor_register_media_hooks();
	cnl_editor_register_gutenberg_route_hooks();
	cnl_editor_register_block_canvas_style_hooks();
	cnl_editor_register_layout_hooks();
	cnl_editor_register_plugin_compat_hooks();
	cnl_editor_register_page_list_hooks();
	cnl_editor_register_post_kind_hooks();
	cnl_editor_register_setup_default_hooks();
}
