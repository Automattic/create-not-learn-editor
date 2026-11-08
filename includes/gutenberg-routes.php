<?php
/**
 * Gutenberg's own screens, mounted in the editor.
 *
 * These are the routes Gutenberg's site-editor-v2 uses, loaded from
 * Gutenberg's build rather than copied, as the media editor is
 * (`includes/media.php`), so they keep up with each release. They edit the
 * same records as the rest of the editor, so their changes join the rest of
 * the unsaved changes.
 *
 * - `/styles`: the full global styles editor, with typography, colors,
 *   layout, styles for each block, revisions, the style book and custom CSS.
 *   The editor's own Design screen leads with whole-site looks and keeps to
 *   colors and fonts; this is for people who want everything. Builder's
 *   Home links to it.
 * - `/font-list`: the font library, where fonts are installed from Google
 *   Fonts, uploaded and removed, in tabs. It's WordPress's Fonts screen
 *   under Appearance. The editor's Fonts screen links to each tab.
 * - `/templates`: the templates list, in place of the editor's own. It
 *   sends `/templates` on to `/templates/list/all`, and opens a template at
 *   `/types/wp_template/edit/$id`, which the editor's post route sends on to
 *   its template editor.
 *
 * @package CreateNotLearnEditor
 */

defined( 'ABSPATH' ) || exit;

/**
 * Register Gutenberg route hooks.
 */
function cnl_editor_register_gutenberg_route_hooks() {
	add_action( CNL_EDITOR_SLUG . '_init', 'cnl_editor_register_gutenberg_routes' );
	add_filter( CNL_EDITOR_SLUG . '_prerequisite_script_dependencies', 'cnl_editor_add_gutenberg_route_script_dependencies' );
}

/**
 * Gutenberg's routes the editor mounts: each one's directory in Gutenberg's
 * `build/routes/`, and its path.
 *
 * @return array[] `name` and `path` for each route.
 */
function cnl_editor_get_gutenberg_routes() {
	return array(
		array(
			'name' => 'styles',
			'path' => '/styles',
		),
		array(
			'name' => 'font-list',
			'path' => '/font-list',
		),
		array(
			'name' => 'template',
			'path' => '/templates',
		),
		array(
			'name' => 'template-list',
			'path' => '/templates/list/$activeView',
		),
	);
}

/**
 * Get one of a Gutenberg route's built files' asset metadata.
 *
 * @param string $route Route directory in Gutenberg's `build/routes/`.
 * @param string $name  `route` or `content`.
 * @return array Asset metadata, or an empty array if Gutenberg doesn't have the file.
 */
function cnl_editor_get_gutenberg_route_asset( $route, $name ) {
	$asset_file = cnl_editor_get_gutenberg_path( 'build/routes/' . $route . '/' . $name . '.min.asset.php' );

	return file_exists( $asset_file ) ? require $asset_file : array();
}

/**
 * Register Gutenberg's routes on the editor's page.
 *
 * Gutenberg only registers the routes' script modules on its own pages, so
 * they are registered here, under the IDs Gutenberg gives them, from its
 * build. A route the installed Gutenberg doesn't have is left out.
 */
function cnl_editor_register_gutenberg_routes() {
	$extension = defined( 'SCRIPT_DEBUG' ) && SCRIPT_DEBUG ? '.js' : '.min.js';

	foreach ( cnl_editor_get_gutenberg_routes() as $route ) {
		$modules = array();

		foreach ( array( 'route', 'content' ) as $name ) {
			$asset = cnl_editor_get_gutenberg_route_asset( $route['name'], $name );

			if ( ! $asset ) {
				continue;
			}

			$id = 'wp/routes/' . $route['name'] . '/' . $name;

			wp_register_script_module(
				$id,
				cnl_editor_get_gutenberg_url( 'build/routes/' . $route['name'] . '/' . $name . $extension ),
				$asset['module_dependencies'] ?? array(),
				$asset['version'] ?? CNL_EDITOR_VERSION
			);

			$modules[ $name ] = $id;
		}

		if ( empty( $modules['route'] ) ) {
			continue;
		}

		cnl_editor_register_route( $route['path'], $modules['content'] ?? null, $modules['route'] );
	}
}

/**
 * Load the classic scripts Gutenberg's routes need before the editor starts.
 *
 * @param string[] $script_deps Script handles.
 * @return string[] Script handles.
 */
function cnl_editor_add_gutenberg_route_script_dependencies( $script_deps ) {
	foreach ( cnl_editor_get_gutenberg_routes() as $route ) {
		foreach ( array( 'route', 'content' ) as $name ) {
			$asset       = cnl_editor_get_gutenberg_route_asset( $route['name'], $name );
			$script_deps = array_merge( $script_deps, $asset['dependencies'] ?? array() );
		}
	}

	return array_values( array_unique( $script_deps ) );
}
