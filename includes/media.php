<?php
/**
 * The Media screen's use of Gutenberg's media experiments.
 *
 * Gutenberg is building a new media library: a modal for picking and
 * uploading media that's powered by DataViews, and an editor for one media
 * item, with cropping and its details, that's a route of its own. Both are
 * experiments, off until someone turns them on under Gutenberg >
 * Experiments. This editor turns them on for its own page only, so the rest
 * of wp-admin is left as the site has it.
 *
 * The media editor is Gutenberg's own route, loaded from Gutenberg's build
 * rather than copied, so it keeps up with each release. The Media screen
 * that lists media is the editor's own (`src/routes/static/media.jsx`), as
 * Gutenberg's media list is part of its Site Editor's post lists.
 *
 * @package CreateNotLearnEditor
 */

defined( 'ABSPATH' ) || exit;

/**
 * The path of Gutenberg's media editor route, relative to its build.
 */
const CNL_EDITOR_MEDIA_EDITOR_ROUTE_PATH = 'build/routes/media-editor/';

/**
 * Register media hooks.
 */
function cnl_editor_register_media_hooks() {
	add_action( CNL_EDITOR_SLUG . '_init', 'cnl_editor_register_media_editor_route' );
	add_action( CNL_EDITOR_SLUG . '_init', 'cnl_editor_enable_media_experiments' );
	add_filter( CNL_EDITOR_SLUG . '_prerequisite_script_dependencies', 'cnl_editor_add_media_editor_script_dependencies' );
}

/**
 * Whether the editor turns on Gutenberg's media experiments on its page.
 *
 * @return bool Whether the media experiments are on.
 */
function cnl_editor_media_experiments_enabled() {
	/**
	 * Filters whether the editor turns on Gutenberg's media experiments, the
	 * DataViews media modal and the media editor, on its own page.
	 *
	 * @param bool $enabled Whether the media experiments are on. Default true.
	 */
	return (bool) apply_filters( CNL_EDITOR_SLUG . '_media_experiments', true );
}

/**
 * Whether the installed Gutenberg has the media editor route, and the
 * editor uses it.
 *
 * @return bool Whether the media editor can be opened.
 */
function cnl_editor_has_media_editor() {
	return cnl_editor_media_experiments_enabled()
		&& file_exists( cnl_editor_get_gutenberg_path( CNL_EDITOR_MEDIA_EDITOR_ROUTE_PATH . 'route.min.asset.php' ) )
		&& file_exists( cnl_editor_get_gutenberg_path( CNL_EDITOR_MEDIA_EDITOR_ROUTE_PATH . 'content.min.asset.php' ) );
}

/**
 * Get one of the media editor route's built files' asset metadata.
 *
 * @param string $name `route` or `content`.
 * @return array Asset metadata.
 */
function cnl_editor_get_media_editor_asset( $name ) {
	$asset_file = cnl_editor_get_gutenberg_path( CNL_EDITOR_MEDIA_EDITOR_ROUTE_PATH . $name . '.min.asset.php' );

	return file_exists( $asset_file ) ? require $asset_file : array();
}

/**
 * Register Gutenberg's media editor route on the editor's page.
 *
 * Gutenberg only registers the route's script modules on its own pages, so
 * they are registered here, under the IDs Gutenberg gives them, from its
 * build.
 */
function cnl_editor_register_media_editor_route() {
	if ( ! cnl_editor_has_media_editor() ) {
		return;
	}

	$extension = defined( 'SCRIPT_DEBUG' ) && SCRIPT_DEBUG ? '.js' : '.min.js';
	$modules   = array();

	foreach ( array( 'route', 'content' ) as $name ) {
		$id    = 'wp/routes/media-editor/' . $name;
		$asset = cnl_editor_get_media_editor_asset( $name );

		wp_register_script_module(
			$id,
			cnl_editor_get_gutenberg_url( CNL_EDITOR_MEDIA_EDITOR_ROUTE_PATH . $name . $extension ),
			$asset['module_dependencies'] ?? array(),
			$asset['version'] ?? CNL_EDITOR_VERSION
		);

		$modules[ $name ] = $id;
	}

	cnl_editor_register_route( '/media-editor/$id', $modules['content'], $modules['route'] );
}

/**
 * Turn on Gutenberg's media experiments for the editor's page.
 *
 * Gutenberg reads these flags as its scripts load, so they're printed in
 * the head, before any of them.
 */
function cnl_editor_enable_media_experiments() {
	if ( ! cnl_editor_media_experiments_enabled() ) {
		return;
	}

	$flags = array( 'window.__experimentalDataViewsMediaModal = true;' );

	if ( cnl_editor_has_media_editor() ) {
		$flags[] = 'window.__experimentalMediaEditor = true;';
	}

	wp_register_script( 'cnl-editor-media-experiments', false, array(), CNL_EDITOR_VERSION, false );
	wp_add_inline_script( 'cnl-editor-media-experiments', implode( "\n", $flags ) );
	wp_enqueue_script( 'cnl-editor-media-experiments' );
}

/**
 * Load the classic scripts the media editor route needs before the editor
 * starts.
 *
 * @param string[] $script_deps Script handles.
 * @return string[] Script handles.
 */
function cnl_editor_add_media_editor_script_dependencies( $script_deps ) {
	if ( ! cnl_editor_has_media_editor() ) {
		return $script_deps;
	}

	foreach ( array( 'route', 'content' ) as $name ) {
		$asset       = cnl_editor_get_media_editor_asset( $name );
		$script_deps = array_merge( $script_deps, $asset['dependencies'] ?? array() );
	}

	return array_values( array_unique( $script_deps ) );
}
