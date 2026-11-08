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
 * Get the name to greet the user by: their first name, or their nickname.
 *
 * WordPress sets the nickname to the username until someone changes it, so
 * an untouched nickname is skipped rather than greeting people by login.
 *
 * @param WP_User $user User to greet.
 * @return string First name, nickname, or an empty string.
 */
function cnl_editor_get_greeting_name( $user ) {
	$first_name = trim( (string) $user->first_name );
	if ( '' !== $first_name ) {
		return $first_name;
	}

	$nickname = trim( (string) $user->nickname );
	if ( '' !== $nickname && $nickname !== $user->user_login ) {
		return $nickname;
	}

	return '';
}

/**
 * Get settings for the editor app.
 *
 * @return array App settings.
 */
function cnl_editor_get_app_settings() {
	$navigation_post_type = get_post_type_object( 'wp_navigation' );
	$theme                = wp_get_theme();
	$current_user         = wp_get_current_user();
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
		'userName'           => cnl_editor_get_greeting_name( $current_user ),
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
		'assistantCanType'   => cnl_editor_assistant_can_type(),
		'assistantModel'     => cnl_editor_get_assistant_model(),
		'assistantRouter'    => cnl_editor_assistant_can_route(),
		'postKinds'          => cnl_editor_get_post_kind_settings(),
		'mediaEditor'        => cnl_editor_has_media_editor(),
		'maxUploadFileSize'  => wp_max_upload_size(),
	);
}

/**
 * Whether people can type to the assistant.
 *
 * Without a language model the assistant answers from a script, so it can
 * only follow its own choices. Typing stays off until a model is connected,
 * through the Agentic Editor plugin and an AI connector. See
 * `cnl_editor_get_assistant_model()`.
 *
 * @return bool Whether the assistant's message box shows.
 */
function cnl_editor_assistant_can_type() {
	return (bool) apply_filters(
		CNL_EDITOR_SLUG . '_assistant_can_type',
		null !== cnl_editor_get_assistant_model()
	);
}
