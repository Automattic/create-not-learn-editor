<?php
/**
 * The sidebar as wp-admin's own menu.
 *
 * The editor's sidebar is wp-admin's menu: core's own markup, from
 * `wp-admin/menu-header.php`, styled by core's `admin-menu` stylesheet, so
 * it looks and behaves as it does on every other admin screen, plugins'
 * items included. Items the editor has a screen for open it in place
 * (`packages/app-init/src/admin-menu.js`); the rest open WordPress's own
 * screen. See `docs/architecture.md`.
 *
 * @package CreateNotLearnEditor
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Add the editor's design screens to wp-admin's Appearance menu.
 */
function cnl_editor_register_admin_menu_hooks() {
	// After the editor's own Appearance link, and core's and plugins' items.
	add_action( 'admin_menu', 'cnl_editor_add_design_menu_items', 1000 );
}

/**
 * The design screens Appearance links to, which wp-admin has no item for.
 *
 * @return array[] Each screen's label and editor path.
 */
function cnl_editor_get_design_menu_items() {
	return array(
		array( __( 'Colors', 'create-not-learn-editor' ), '/design/colors' ),
		array( __( 'Site Identity', 'create-not-learn-editor' ), '/design/identity' ),
		array( __( 'Header & footer', 'create-not-learn-editor' ), '/design/header-footer' ),
	);
}

/**
 * Put the design screens in Appearance, after Editor, as links into this
 * editor. They're real submenu items, so wp-admin shows them on every admin
 * screen too, where they open the editor on that screen.
 */
function cnl_editor_add_design_menu_items() {
	global $submenu;

	if ( empty( $submenu['themes.php'] ) || ! current_user_can( 'edit_theme_options' ) ) {
		return;
	}

	$items = array();
	foreach ( cnl_editor_get_design_menu_items() as list( $label, $path ) ) {
		$items[] = array(
			$label,
			'edit_theme_options',
			'admin.php?page=' . CNL_EDITOR_SLUG . '&p=' . rawurlencode( $path ),
			$label,
		);
	}

	$entries = array_values( $submenu['themes.php'] );

	// Fonts, core's or the Gutenberg plugin's, joins them, after Colors.
	foreach ( $entries as $index => $entry ) {
		if ( '/design/fonts' === cnl_editor_get_admin_menu_route( cnl_editor_get_admin_submenu_url( $entry[2] ?? '', 'themes.php' ) ) ) {
			array_splice( $items, 1, 0, array_splice( $entries, $index, 1 ) );
			break;
		}
	}

	$after = count( $entries );
	foreach ( $entries as $index => $entry ) {
		if ( 0 === strpos( $entry[2] ?? '', 'site-editor.php' ) ) {
			$after = $index + 1;
			break;
		}
	}

	array_splice( $entries, $after, 0, $items );
	$submenu['themes.php'] = $entries; // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited
}

/**
 * Load what wp-admin's menu needs: core's stylesheet for it, and `utils`,
 * which remembers whether it's collapsed as wp-admin does.
 */
function cnl_editor_enqueue_admin_menu() {
	wp_enqueue_style( 'dashicons' );
	wp_enqueue_style( 'admin-menu' );
	wp_enqueue_script( 'utils' );
}

/**
 * Body classes wp-admin's menu styles depend on.
 *
 * @return string Space-separated classes.
 */
function cnl_editor_get_admin_menu_body_class() {
	$classes = array( 'js', 'auto-fold', 'sticky-menu', 'cnl-has-admin-menu' );

	if ( 'f' === get_user_setting( 'mfold' ) ) {
		$classes[] = 'folded';
	}

	return implode( ' ', $classes );
}

/**
 * Print wp-admin's menu, exactly as wp-admin prints it.
 *
 * `#wpwrap` is where wp-admin marks the menu open on small screens.
 */
function cnl_editor_print_admin_menu() {
	echo '<div id="wpwrap" class="cnl-admin-menu">';
	require ABSPATH . 'wp-admin/menu-header.php';
	echo '</div>';
}

/**
 * The editor's screens for wp-admin's menu links, by each link's URL
 * relative to wp-admin, as `_wp_menu_output()` writes it.
 *
 * @return array<string,string> Editor paths, by wp-admin URL.
 */
function cnl_editor_get_admin_menu_routes() {
	global $menu, $submenu;

	$routes = array();
	$add    = function ( $url ) use ( &$routes ) {
		$route = cnl_editor_get_admin_menu_route( $url );
		if ( null !== $route ) {
			$routes[ $url ] = $route;
		}
	};

	foreach ( (array) $menu as $top ) {
		if ( empty( $top[2] ) ) {
			continue;
		}

		$add( cnl_editor_get_admin_top_menu_url( $top[2] ) );

		foreach ( $submenu[ $top[2] ] ?? array() as $sub ) {
			if ( ! empty( $sub[2] ) ) {
				$add( cnl_editor_get_admin_submenu_url( $sub[2], $top[2] ) );
			}
		}
	}

	return $routes;
}

/**
 * Whether a menu slug is a plugin's page, reached through `?page=`, rather
 * than a file in wp-admin. As `_wp_menu_output()` decides it.
 *
 * @param string $slug   The menu slug.
 * @param string $parent The parent slug.
 * @return bool Whether it's a plugin page.
 */
function cnl_editor_is_admin_plugin_page( $slug, $parent ) {
	$file = preg_replace( '/\?.*$/', '', $slug );

	return ! empty( get_plugin_page_hook( $slug, $parent ) )
		|| ( 'index.php' !== $slug && file_exists( WP_PLUGIN_DIR . "/$file" ) && ! file_exists( ABSPATH . "wp-admin/$file" ) );
}

/**
 * A top-level item's wp-admin URL, relative to wp-admin.
 *
 * @param string $slug The menu slug.
 * @return string Relative URL.
 */
function cnl_editor_get_admin_top_menu_url( $slug ) {
	return cnl_editor_is_admin_plugin_page( $slug, 'admin.php' ) ? 'admin.php?page=' . $slug : $slug;
}

/**
 * A submenu item's wp-admin URL, relative to wp-admin.
 *
 * @param string $slug   The submenu slug.
 * @param string $parent The parent's slug.
 * @return string Relative URL.
 */
function cnl_editor_get_admin_submenu_url( $slug, $parent ) {
	if ( ! cnl_editor_is_admin_plugin_page( $slug, $parent ) ) {
		return $slug;
	}

	$parent_file = preg_replace( '/\?.*$/', '', $parent );
	if ( '.php' === substr( $parent_file, -4 ) && 'admin.php' !== $parent_file ) {
		return add_query_arg( 'page', $slug, $parent );
	}

	return add_query_arg( 'page', $slug, 'admin.php' );
}

/**
 * The editor's screen for a wp-admin URL.
 *
 * @param string $url A URL relative to wp-admin.
 * @return string|null Editor path, or null when it has none.
 */
function cnl_editor_get_admin_menu_route( $url ) {
	$file = preg_replace( '/\?.*$/', '', $url );
	$args = array();
	$qs   = wp_parse_url( $url, PHP_URL_QUERY );
	if ( $qs ) {
		wp_parse_str( $qs, $args );
	}

	$types = wp_list_pluck( cnl_editor_get_content_post_type_data(), 'name' );

	// Appearance's links into this editor: its own, and its design screens'.
	if ( CNL_EDITOR_SLUG === ( $args['page'] ?? '' ) ) {
		return empty( $args['p'] ) ? '/' : (string) $args['p'];
	}

	// Fonts, as core and the Gutenberg plugin each register it.
	if ( 'font-library.php' === $file || 'font-library-wp-admin' === ( $args['page'] ?? '' ) ) {
		return '/design/fonts';
	}

	switch ( $file ) {
		case 'index.php':
			return '/';

		case 'upload.php':
			return '/media';

		case 'nav-menus.php':
			return '/navigation';

		case 'edit.php':
		case 'post-new.php':
			$type = $args['post_type'] ?? 'post';

			if ( 'wp_block' === $type && 'edit.php' === $file ) {
				return '/patterns';
			}

			if ( 'product' === $type && 'edit.php' === $file && cnl_editor_has_shop() ) {
				return '/shop/products';
			}

			if ( ! in_array( $type, $types, true ) ) {
				return null;
			}

			return '/types/' . $type . ( 'post-new.php' === $file ? '/new' : '' );

		case 'site-editor.php':
			$path = $args['p'] ?? $args['path'] ?? '';
			$map  = array(
				''                    => '/site-overview',
				'/'                   => '/site-overview',
				'/styles'             => '/styles',
				'/wp_global_styles'   => '/styles',
				'/pattern'            => '/patterns',
				'/patterns'           => '/patterns',
				'/template'           => '/templates',
				'/wp_template'        => '/templates',
				'/wp_template/all'    => '/templates',
				'/wp_template_part'   => '/template-parts',
				'/wp_template_part/all' => '/template-parts',
				'/navigation'         => '/navigation',
				'/page'               => '/types/page',
			);
			return $map[ $path ] ?? null;
	}

	return null;
}
