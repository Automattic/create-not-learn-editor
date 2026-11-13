<?php
/**
 * The settings the editor reads from `window.createNotLearnEditor`.
 *
 * @package CreateNotLearnEditor
 */

defined( 'ABSPATH' ) || exit;

/**
 * Get the visual theme layered on top of the design system.
 *
 * @return string Theme name: 'modern' or 'default'.
 */
function cnl_editor_get_ui_theme() {
	/**
	 * Filters the visual theme for the full-page editor.
	 *
	 * @param string $theme Theme name: 'modern' or 'default'.
	 */
	$theme = apply_filters( CNL_EDITOR_SLUG . '_ui_theme', CNL_EDITOR_UI_THEME );

	return in_array( $theme, array( 'modern', 'default' ), true ) ? $theme : 'default';
}

/**
 * Get settings for the editor app.
 *
 * @return array App settings.
 */
function cnl_editor_get_app_settings() {
	$navigation_post_type = get_post_type_object( 'wp_navigation' );
	$theme                = wp_get_theme();
	$lazy_editor_file     = cnl_editor_get_gutenberg_path( 'build/modules/lazy-editor/index.js' );
	$lazy_editor_version  = file_exists( $lazy_editor_file )
		? filemtime( $lazy_editor_file )
		: CNL_EDITOR_VERSION;

	return array(
		'version'             => CNL_EDITOR_VERSION,
		'minGutenberg'       => CNL_EDITOR_MIN_GUTENBERG_VERSION,
		'gutenbergVersion'   => defined( 'GUTENBERG_VERSION' ) ? GUTENBERG_VERSION : null,
		'restNamespace'      => CNL_EDITOR_REST_NAMESPACE,
		'restRoot'           => esc_url_raw( rest_url() ),
		'nonce'              => wp_create_nonce( 'wp_rest' ),
		'adminUrl'           => admin_url(),
		'homeUrl'            => home_url( '/' ),
		'lazyEditorModuleUrl' => add_query_arg(
			'ver',
			$lazy_editor_version,
			cnl_editor_get_gutenberg_url( 'build/modules/lazy-editor/index.js' )
		),
		'siteName'           => get_bloginfo( 'name' ),
		'uiTheme'            => cnl_editor_get_ui_theme(),
		'themeName'          => $theme->get( 'Name' ),
		'showOnFront'        => get_option( 'show_on_front' ),
		'pageOnFront'        => (int) get_option( 'page_on_front' ),
		'postTypes'          => cnl_editor_get_content_post_type_data(),
		'editablePostTypes'  => cnl_editor_get_editable_post_type_data(),
		'shop'               => cnl_editor_get_shop_settings(),
		'blogAdmin'          => cnl_editor_get_blog_admin_settings(),
		'navigationRestBase' => $navigation_post_type && $navigation_post_type->rest_base
			? $navigation_post_type->rest_base
			: 'navigation',
		'postKinds'          => cnl_editor_get_post_kind_settings(),
		'mediaEditor'        => cnl_editor_has_media_editor(),
		'maxUploadFileSize'  => wp_max_upload_size(),
	);
}
