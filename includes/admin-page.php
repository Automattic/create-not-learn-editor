<?php
/**
 * Admin page registration and rendering.
 *
 * @package CreateNotLearnEditor
 */

defined( 'ABSPATH' ) || exit;

/**
 * Register admin page hooks.
 */
function cnl_editor_register_admin_page_hooks() {
	add_action( 'admin_menu', 'cnl_editor_register_admin_menu' );
	add_action( 'admin_init', 'cnl_editor_intercept_full_page_render' );
}

/**
 * Register the hidden full-page editor and visible Appearance link.
 */
function cnl_editor_register_admin_menu() {
	$GLOBALS['cnl_editor_admin_hook'] = add_submenu_page(
		'nothing',
		__( 'Create Not Learn Editor', 'create-not-learn-editor' ),
		__( 'Create Not Learn Editor', 'create-not-learn-editor' ),
		'edit_theme_options',
		CNL_EDITOR_SLUG,
		'cnl_editor_render_full_page'
	);

	global $submenu;

	if ( isset( $submenu['themes.php'] ) ) {
		$submenu['themes.php'][] = array(
			__( 'Create Not Learn', 'create-not-learn-editor' ),
			'edit_theme_options',
			'admin.php?page=' . CNL_EDITOR_SLUG,
		);
	}
}

/**
 * Check whether this request is for the full-page editor.
 *
 * @return bool Whether this is the full-page editor request.
 */
function cnl_editor_is_full_page_request() {
	// `admin_init` fires for `admin-ajax.php` and `admin-post.php` too.
	if ( wp_doing_ajax() || 'admin.php' !== ( $GLOBALS['pagenow'] ?? '' ) ) {
		return false;
	}

	$page = filter_input( INPUT_GET, 'page', FILTER_SANITIZE_FULL_SPECIAL_CHARS );

	return CNL_EDITOR_SLUG === $page;
}

/**
 * Render the full-page editor before WordPress prints the standard admin shell.
 */
function cnl_editor_intercept_full_page_render() {
	if ( cnl_editor_is_full_page_request() ) {
		cnl_editor_render_full_page();
	}
}

/**
 * Render the editor as a generated full-page admin document.
 */
function cnl_editor_render_full_page() {
	if ( ! current_user_can( 'edit_theme_options' ) ) {
		wp_die( esc_html__( 'Sorry, you are not allowed to access this page.', 'create-not-learn-editor' ) );
	}

	set_current_screen();

	// Sync the user's settings cookie, as admin-header.php does, so the media
	// modal opens on the tab it was last left on.
	wp_user_settings();

	remove_action( 'admin_head', 'wp_admin_bar_header' );

	foreach ( wp_scripts()->queue as $script ) {
		wp_dequeue_script( $script );
	}
	foreach ( wp_styles()->queue as $style ) {
		wp_dequeue_style( $style );
	}

	$has_admin_bar = cnl_editor_enable_admin_bar();

	cnl_editor_reset_editor_registry();

	/**
	 * Fires when the full-page editor is initialized so extensions can register
	 * routes and menu items.
	 */
	do_action( CNL_EDITOR_SLUG . '_init' );

	$menu_items   = cnl_editor_get_registered_menu_items();
	$routes       = cnl_editor_get_registered_routes();
	$assets_ready = cnl_editor_enqueue_full_page_assets( $routes, $menu_items );

	?>
	<!DOCTYPE html>
	<html <?php language_attributes(); ?>>
	<head>
		<meta charset="<?php bloginfo( 'charset' ); ?>">
		<meta name="viewport" content="width=device-width, initial-scale=1">
		<title><?php echo esc_html( get_admin_page_title() ); ?></title>
		<style>
			html {
				background: #f1f1f1;
				color: #444;
				font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
				font-size: 13px;
				line-height: 1.4em;
			}
			body {
				margin: 0;
			}
			<?php if ( ! $has_admin_bar ) : ?>
			#wpadminbar {
				display: none;
			}
			<?php endif; ?>
		</style>
	<?php
	global $hook_suffix;
	// phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited
	$hook_suffix = CNL_EDITOR_SLUG;

	cnl_editor_print_ui_theme_font_preload();
	print_admin_styles();
	// Core prints these on `admin_print_styles`, which this page doesn't fire.
	// The font pickers show the theme's fonts, so they need them loaded.
	wp_print_font_faces();
	wp_print_font_faces_from_style_variations();
	print_head_scripts();

	/** This action is documented in wp-admin/admin-header.php */
	do_action( "admin_head-{$hook_suffix}" );

	/** This action is documented in wp-admin/admin-header.php */
	do_action( 'admin_head' );
	?>
	</head>
	<body class="<?php echo esc_attr( 'create-not-learn-editor cnl-ui-theme-' . cnl_editor_get_ui_theme() . ( $has_admin_bar ? ' ' . cnl_editor_get_admin_color_class() : '' ) . ( $has_admin_bar && cnl_editor_user_shows_admin_bar() ? ' admin-bar' : '' ) ); ?>"<?php echo 'modern' === cnl_editor_get_ui_theme() ? ' data-wpds-corner-radius="moderate"' : ''; ?>>
		<div id="create-not-learn-editor-app" style="height: 100vh; box-sizing: border-box;">
			<?php if ( ! $assets_ready ) : ?>
				<div class="cnl-editor-loading">
					<?php esc_html_e( 'Create Not Learn Editor assets are missing. Run npm install and npm run build in the plugin directory.', 'create-not-learn-editor' ); ?>
				</div>
			<?php endif; ?>
		</div>
	<?php
	if ( $has_admin_bar ) {
		wp_admin_bar_render();
	}

	/** This action is documented in wp-admin/admin-footer.php */
	do_action( 'admin_footer', '' );

	cnl_editor_register_lazy_editor_compat_module();
	wp_script_modules()->print_import_map();
	print_footer_scripts();
	wp_script_modules()->print_enqueued_script_modules();
	wp_script_modules()->print_script_module_preloads();
	wp_script_modules()->print_script_module_data();

	/** This action is documented in wp-admin/admin-footer.php */
	do_action( "admin_footer-{$hook_suffix}" );
	?>
	</body>
	</html>
	<?php
	exit;
}
