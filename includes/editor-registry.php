<?php
/**
 * The routes and sidebar menu items of the full-page editor.
 *
 * Extensions add their own on the `create-not-learn-editor_init` action with
 * `cnl_editor_register_route()` and `cnl_editor_register_menu_item()`.
 *
 * @package CreateNotLearnEditor
 */

defined( 'ABSPATH' ) || exit;

/**
 * Register editor registry hooks.
 */
function cnl_editor_register_editor_registry_hooks() {
	add_action( CNL_EDITOR_SLUG . '_init', 'cnl_editor_register_default_routes_and_menu', 5 );
}

/**
 * Reset the per-request editor route and menu registries.
 */
function cnl_editor_reset_editor_registry() {
	$GLOBALS['cnl_editor_routes']     = array();
	$GLOBALS['cnl_editor_menu_items'] = array();
}

/**
 * Register a route for the Create Not Learn full-page editor.
 *
 * A route the current user can't use is registered with the "Not available"
 * screen in place of its own modules, so a link to it explains itself rather
 * than loading a screen they can't use.
 *
 * @param string                   $path           Route path.
 * @param string|null              $content_module Script module ID for stage/inspector content.
 * @param string|null              $route_module   Script module ID for route lifecycle hooks.
 * @param string|string[]|Closure $capability     What the route needs, as
 *                                                 `cnl_editor_user_can()`
 *                                                 takes it. Empty for anyone
 *                                                 who can open the editor.
 */
function cnl_editor_register_route( $path, $content_module = null, $route_module = null, $capability = '' ) {
	if ( ! cnl_editor_user_can( $capability ) ) {
		$content_module = 'create-not-learn-editor/routes/not-available/content';
		$route_module   = 'create-not-learn-editor/routes/not-available/route';
	}

	$route = array( 'path' => $path );
	if ( ! empty( $content_module ) ) {
		$route['content_module'] = $content_module;
	}
	if ( ! empty( $route_module ) ) {
		$route['route_module'] = $route_module;
	}

	$GLOBALS['cnl_editor_routes'][] = $route;
}

/**
 * Register a menu item for the Create Not Learn full-page editor.
 *
 * @param string $id           Menu item ID.
 * @param string $label        Menu item label.
 * @param string $to           Route path.
 * @param string $parent_id    Optional parent item ID.
 * @param string $parent_type  Optional parent type.
 * @param string $icon         Optional dashicon class.
 * @param string $section      Optional sidebar section ID, like `site` or
 *                             `advanced`, which titles the item's group.
 * @param bool   $always_shown Whether the item stays listed when its section
 *                             puts the rest behind a "…".
 * @param string|string[]|Closure $capability What the item needs, as
 *                                             `cnl_editor_user_can()` takes
 *                                             it. Empty for anyone who can
 *                                             open the editor.
 */
function cnl_editor_register_menu_item( $id, $label, $to, $parent_id = '', $parent_type = '', $icon = '', $section = '', $always_shown = false, $capability = '' ) {
	// Only what this person can use is listed.
	if ( ! cnl_editor_user_can( $capability ) ) {
		return;
	}

	$menu_item = array(
		'id'    => $id,
		'label' => $label,
		'to'    => $to,
	);

	if ( ! empty( $icon ) ) {
		$menu_item['icon'] = $icon;
	}

	if ( ! empty( $parent_id ) ) {
		$menu_item['parent'] = $parent_id;
	}

	if ( ! empty( $parent_type ) && in_array( $parent_type, array( 'drilldown', 'dropdown' ), true ) ) {
		$menu_item['parent_type'] = $parent_type;
	}

	if ( ! empty( $section ) ) {
		$menu_item['section'] = $section;
	}

	if ( $always_shown ) {
		$menu_item['alwaysShown'] = true;
	}

	$GLOBALS['cnl_editor_menu_items'][] = $menu_item;
}

/**
 * Get registered full-page editor routes.
 *
 * @return array[] Registered routes.
 */
function cnl_editor_get_registered_routes() {
	return $GLOBALS['cnl_editor_routes'] ?? array();
}

/**
 * Get the paths of the registered routes the current user can use.
 *
 * @return string[] Route paths.
 */
function cnl_editor_get_available_route_paths() {
	$paths = array();

	foreach ( cnl_editor_get_registered_routes() as $route ) {
		if ( 0 !== strpos( $route['route_module'] ?? '', 'create-not-learn-editor/routes/not-available/' ) ) {
			$paths[] = $route['path'];
		}
	}

	return $paths;
}

/**
 * Get registered full-page editor menu items.
 *
 * @return array[] Registered menu items.
 */
function cnl_editor_get_registered_menu_items() {
	return $GLOBALS['cnl_editor_menu_items'] ?? array();
}

/**
 * Register the plugin's default routes and menu items.
 */
function cnl_editor_register_default_routes_and_menu() {
	foreach ( cnl_editor_get_routes() as $route ) {
		cnl_editor_register_route(
			$route['path'],
			$route['content_module'] ?? null,
			$route['route_module'] ?? null,
			$route['capability'] ?? ''
		);
	}

	foreach ( cnl_editor_get_menu_items() as $item ) {
		cnl_editor_register_menu_item(
			$item['id'],
			$item['label'],
			$item['to'],
			$item['parent'] ?? '',
			$item['parent_type'] ?? '',
			$item['icon'] ?? '',
			$item['section'] ?? '',
			! empty( $item['alwaysShown'] ),
			$item['capability'] ?? ''
		);
	}
}

/**
 * Get route definitions for the boot app.
 *
 * @return array[] Route definitions.
 */
function cnl_editor_get_routes() {
	$routes = array(
		array(
			'path'           => '/',
			'route_module'   => 'create-not-learn-editor/routes/home/route',
			'content_module' => 'create-not-learn-editor/routes/home/content',
		),
		array(
			'path'           => '/site-overview',
			'capability'     => 'site',
			'route_module'   => 'create-not-learn-editor/routes/site-overview/route',
			'content_module' => 'create-not-learn-editor/routes/site-overview/content',
		),
		array(
			'path'           => '/types/$type',
			'route_module'   => 'create-not-learn-editor/routes/content/route',
			'content_module' => 'create-not-learn-editor/routes/content/content',
		),
		array(
			'path'           => '/types/$type/list/$view',
			'route_module'   => 'create-not-learn-editor/routes/content/route',
			'content_module' => 'create-not-learn-editor/routes/content/content',
		),
		array(
			'path'         => '/types/$type/edit/$id',
			'route_module' => 'create-not-learn-editor/routes/post-edit/route',
		),
		array(
			'path'         => '/types/$type/new',
			'route_module' => 'create-not-learn-editor/routes/post-new/route',
		),
		array(
			'path'           => '/navigation',
			'capability'     => 'site',
			'route_module'   => 'create-not-learn-editor/routes/navigation/route',
			'content_module' => 'create-not-learn-editor/routes/navigation/content',
		),
		array(
			'path'           => '/navigation/edit/$id',
			'capability'     => 'site',
			'route_module'   => 'create-not-learn-editor/routes/navigation-edit/route',
			'content_module' => 'create-not-learn-editor/routes/navigation-edit/content',
		),
		array(
			'path'         => '/wp_template',
			'capability'   => 'site',
			'route_module' => 'create-not-learn-editor/routes/template-edit/route',
		),
		array(
			'path'         => '/wp_template_part',
			'capability'   => 'site',
			'route_module' => 'create-not-learn-editor/routes/template-part-edit/route',
		),
		array(
			'path'           => '/media',
			'capability'     => 'media',
			'route_module'   => 'create-not-learn-editor/routes/static/route',
			'content_module' => 'create-not-learn-editor/routes/static/content',
		),
		/*
		 * Gutenberg's media editor links back to its own media list, here.
		 * The route sends it on to the Media screen. See `includes/media.php`.
		 */
		array(
			'path'         => '/types/attachment/list/$view',
			'capability'   => 'media',
			'route_module' => 'create-not-learn-editor/routes/static/route',
		),
		array(
			'path'           => '/design',
			'capability'     => 'site',
			'route_module'   => 'create-not-learn-editor/routes/static/route',
			'content_module' => 'create-not-learn-editor/routes/static/content',
		),
		array(
			'path'           => '/design/colors',
			'capability'     => 'site',
			'route_module'   => 'create-not-learn-editor/routes/static/route',
			'content_module' => 'create-not-learn-editor/routes/static/content',
		),
		array(
			'path'           => '/design/fonts',
			'capability'     => 'site',
			'route_module'   => 'create-not-learn-editor/routes/static/route',
			'content_module' => 'create-not-learn-editor/routes/static/content',
		),
		array(
			'path'           => '/design/identity',
			'capability'     => 'identity',
			'route_module'   => 'create-not-learn-editor/routes/static/route',
			'content_module' => 'create-not-learn-editor/routes/static/content',
		),
		array(
			'path'           => '/site-parts',
			'capability'     => 'site',
			'route_module'   => 'create-not-learn-editor/routes/site-parts/route',
			'content_module' => 'create-not-learn-editor/routes/site-part/content',
		),
		array(
			'path'           => '/site-parts/header',
			'capability'     => 'site',
			'route_module'   => 'create-not-learn-editor/routes/header/route',
			'content_module' => 'create-not-learn-editor/routes/site-part/content',
		),
		array(
			'path'           => '/site-parts/footer',
			'capability'     => 'site',
			'route_module'   => 'create-not-learn-editor/routes/footer/route',
			'content_module' => 'create-not-learn-editor/routes/site-part/content',
		),
		array(
			'path'           => '/patterns',
			'capability'     => 'site',
			'route_module'   => 'create-not-learn-editor/routes/static/route',
			'content_module' => 'create-not-learn-editor/routes/static/content',
		),
		array(
			'path'           => '/template-parts',
			'capability'     => 'site',
			'route_module'   => 'create-not-learn-editor/routes/static/route',
			'content_module' => 'create-not-learn-editor/routes/static/content',
		),
		// `/templates` is Gutenberg's own, see `includes/gutenberg-routes.php`.
		// Where a list or an editor sends someone who can't open what it was
		// asked for.
		array(
			'path'           => '/not-available',
			'route_module'   => 'create-not-learn-editor/routes/not-available/route',
			'content_module' => 'create-not-learn-editor/routes/not-available/content',
		),
	);

	return array_merge( $routes, cnl_editor_get_shop_routes() );
}

/**
 * Get menu item definitions for the boot app.
 *
 * @return array[] Menu item definitions.
 */
function cnl_editor_get_menu_items() {
	$post_types = cnl_editor_get_content_post_type_data();
	$items      = array(
		array(
			'id'    => 'home',
			'icon'  => 'dashicons-admin-home',
			'label' => __( 'Home', 'create-not-learn-editor' ),
			'to'    => '/',
		),
	);

	/*
	 * Below Home, each item is in a section of the sidebar, which app-init
	 * titles and can fold away (`packages/app-init/src/menu-sections.jsx`).
	 * Each section's items are kept together, in the order listed here.
	 */

	// Content: Pages, Posts and any custom post types.
	$products = null;
	foreach ( $post_types as $post_type ) {
		// The shop's products open its own Products screen, and are always
		// listed, after Posts, rather than behind the section's "…".
		if ( 'product' === $post_type['name'] && cnl_editor_has_shop() ) {
			$products = array(
				'id'          => 'content-product',
				'icon'        => $post_type['menuIcon'],
				'label'       => $post_type['menuName'],
				'to'          => '/shop/products',
				'section'     => 'content',
				'alwaysShown' => true,
				'capability'  => 'edit_products',
			);
			continue;
		}

		$items[] = array(
			'id'         => 'page' === $post_type['name'] ? 'pages' : 'content-' . $post_type['name'],
			'icon'       => $post_type['menuIcon'],
			'label'      => $post_type['menuName'],
			// The route prefix, not a specific list view: switching tabs or
			// filters within the list (or editing/creating an item) changes
			// the URL past this point, and the sidebar's drilldown-restoration
			// logic matches by longest `to` prefix, so this must cover every
			// URL under this post type for the drilldown to stay open.
			'to'         => '/types/' . $post_type['name'],
			'section'    => 'content',
			// Only the kinds of content this person can write are listed.
			'capability' => get_post_type_object( $post_type['name'] )->cap->edit_posts,
		);
	}

	if ( $products ) {
		$after_posts = array_search( 'content-post', array_column( $items, 'id' ), true );
		array_splice( $items, false === $after_posts ? count( $items ) : $after_posts + 1, 0, array( $products ) );
	}

	return array_merge(
		$items,
		array(
			array(
				'id'         => 'site-overview',
				'capability' => 'site',
				'icon'       => 'dashicons-networking',
				'label'      => __( 'Site overview', 'create-not-learn-editor' ),
				'to'         => '/site-overview',
				'section'    => 'site',
			),
			// The parts every page shares, the main ones, each leading on to
			// the rest in its area.
			array(
				'id'         => 'site-parts',
				'capability' => 'site',
				'icon'       => 'dashicons-layout',
				'label'      => __( 'Site parts', 'create-not-learn-editor' ),
				'to'         => '/site-parts',
				'section'    => 'site',
			),
			// The main menu is managed on the Pages screen; this is for the rest.
			array(
				'id'         => 'navigation',
				'capability' => 'site',
				'label'      => __( 'Menus', 'create-not-learn-editor' ),
				'to'         => '/navigation',
				'section'    => 'site',
			),
			array(
				'id'         => 'identity',
				'capability' => 'identity',
				'icon'       => 'dashicons-id',
				'label'      => __( 'Name & logo', 'create-not-learn-editor' ),
				'to'         => '/design/identity',
				'section'    => 'site',
			),
			array(
				'id'         => 'media',
				'capability' => 'media',
				'icon'       => 'dashicons-admin-media',
				'label'      => __( 'Media', 'create-not-learn-editor' ),
				'to'         => '/media',
				'section'    => 'site',
			),
			// The Design screen itself is reached from Home.
			array(
				'id'         => 'colors',
				'capability' => 'site',
				'icon'       => 'dashicons-art',
				'label'      => __( 'Colors', 'create-not-learn-editor' ),
				'to'         => '/design/colors',
				'section'    => 'design',
			),
			array(
				'id'         => 'fonts',
				'capability' => 'site',
				'icon'       => 'dashicons-editor-textcolor',
				'label'      => __( 'Fonts', 'create-not-learn-editor' ),
				'to'         => '/design/fonts',
				'section'    => 'design',
			),
		),
		// Plugins: those that add to the site, each leading to its screens.
		cnl_editor_get_shop_extension_menu_items(),
		array(
			// Gutenberg's full Styles editor (`includes/gutenberg-routes.php`),
			// for every style setting the Design screens leave out.
			array(
				'id'         => 'styles',
				'capability' => 'site',
				'label'      => __( 'Styles', 'create-not-learn-editor' ),
				'to'         => '/styles',
				'section'    => 'advanced',
			),
			array(
				'id'         => 'patterns',
				'capability' => 'site',
				'label'      => __( 'Patterns', 'create-not-learn-editor' ),
				'to'         => '/patterns',
				'section'    => 'advanced',
			),
			array(
				'id'         => 'templateParts',
				'capability' => 'site',
				'label'      => __( 'All site parts', 'create-not-learn-editor' ),
				'to'         => '/template-parts',
				'section'    => 'advanced',
			),
			array(
				'id'         => 'templates',
				'capability' => 'site',
				'label'      => __( 'Templates', 'create-not-learn-editor' ),
				'to'         => '/templates',
				'section'    => 'advanced',
			),
		)
	);
}
