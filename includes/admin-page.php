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
 * Reset the per-request editor route and menu registries.
 */
function cnl_editor_reset_editor_registry() {
	$GLOBALS['cnl_editor_routes']     = array();
	$GLOBALS['cnl_editor_menu_items'] = array();
}

/**
 * Register a route for the Create Not Learn full-page editor.
 *
 * @param string      $path           Route path.
 * @param string|null $content_module Script module ID for stage/inspector content.
 * @param string|null $route_module   Script module ID for route lifecycle hooks.
 */
function cnl_editor_register_route( $path, $content_module = null, $route_module = null ) {
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
 */
function cnl_editor_register_menu_item( $id, $label, $to, $parent_id = '', $parent_type = '', $icon = '', $section = '', $always_shown = false ) {
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
			$route['route_module'] ?? null
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
			! empty( $item['alwaysShown'] )
		);
	}
}
add_action( CNL_EDITOR_SLUG . '_init', 'cnl_editor_register_default_routes_and_menu', 5 );

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
	$lazy_editor_file     = WP_PLUGIN_DIR . '/gutenberg/build/modules/lazy-editor/index.js';
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
			plugins_url( 'gutenberg/build/modules/lazy-editor/index.js' )
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

/**
 * Preload REST API data used by boot-based editor pages.
 */
function cnl_editor_preload_data() {
	$preload_paths = array(
		/*
		 * Boot reads the site's base record before anything renders. Its
		 * fields must be the ones core-data asks for, in the same order, or
		 * the preload is never used and the request is made again. See
		 * `__unstableBase` in core-data's `entities.js`, which Gutenberg's
		 * `gutenberg_block_editor_preload_paths_7_1()` mirrors.
		 */
		'/?_fields=description,gmt_offset,home,image_max_bit_depth,image_sizes,image_size_threshold,image_strip_meta,name,site_icon,site_icon_url,site_logo,timezone_string,url,page_for_posts,page_on_front,show_on_front',
		// The top bar's save controls read the site's settings on every screen.
		'/wp/v2/settings',
		array( '/wp/v2/settings', 'OPTIONS' ),
	);

	$preload_data = array_reduce(
		$preload_paths,
		'rest_preload_api_request',
		array()
	);

	wp_add_inline_script(
		'wp-api-fetch',
		sprintf(
			'wp.apiFetch.use( wp.apiFetch.createPreloadingMiddleware( %s ) );',
			wp_json_encode( $preload_data )
		),
		'after'
	);
}

/**
 * Get classic script dependencies required before script modules execute.
 *
 * @param array $boot_asset Gutenberg boot module asset metadata.
 * @return string[] Script handles.
 */
function cnl_editor_get_prerequisite_script_dependencies( $boot_asset ) {
	$script_deps = $boot_asset['dependencies'] ?? array();

	foreach ( cnl_editor_get_route_module_assets() as $asset ) {
		$script_deps = array_merge( $script_deps, $asset['dependencies'] ?? array() );
	}

	$script_deps = array_merge(
		$script_deps,
		array(
			'wp-api-fetch',
			'wp-components',
			'wp-element',
			'wp-i18n',
			'wp-url',
		)
	);

	/**
	 * Filters the classic scripts loaded before the editor starts, for
	 * routes whose modules aren't the plugin's own.
	 *
	 * @param string[] $script_deps Script handles.
	 */
	$script_deps = apply_filters( CNL_EDITOR_SLUG . '_prerequisite_script_dependencies', $script_deps );

	return array_values( array_unique( $script_deps ) );
}

/**
 * Enqueue scripts and styles for the full-page editor document.
 *
 * @param array[] $routes     Registered routes.
 * @param array[] $menu_items Registered menu items.
 * @return bool Whether runtime assets were found and enqueued.
 */
function cnl_editor_enqueue_full_page_assets( $routes, $menu_items ) {
	$loader_file = CNL_EDITOR_PATH . 'build/pages/' . CNL_EDITOR_SLUG . '/loader.js';

	if ( ! file_exists( $loader_file ) ) {
		return false;
	}

	/*
	 * The command palette's styles only. App init mounts the palette with the
	 * editor's own commands, so core's, which add every wp-admin menu item and
	 * Site Editor screen, are left out.
	 */
	wp_enqueue_style( 'wp-commands' );

	wp_enqueue_media();

	cnl_editor_preload_data();
	cnl_editor_register_boot_modules( $routes );
	cnl_editor_enqueue_built_styles();
	cnl_editor_enqueue_ui_theme_fonts();

	$boot_asset  = cnl_editor_get_gutenberg_boot_asset();
	$script_deps = cnl_editor_get_prerequisite_script_dependencies( $boot_asset );

	wp_register_script(
		'cnl-editor-prerequisites',
		'',
		$script_deps,
		$boot_asset['version'] ?? CNL_EDITOR_VERSION,
		true
	);

	wp_add_inline_script(
		'cnl-editor-prerequisites',
		'window.createNotLearnEditor = ' . wp_json_encode( cnl_editor_get_app_settings() ) . ';',
		'before'
	);

	wp_add_inline_script(
		'cnl-editor-prerequisites',
		sprintf(
			'import("@wordpress/boot").then((mod) => mod.init({ mountId: %s, menuItems: %s, routes: %s, initModules: %s, dashboardLink: %s }));',
			wp_json_encode( 'create-not-learn-editor-app' ),
			wp_json_encode( $menu_items, JSON_HEX_TAG | JSON_UNESCAPED_SLASHES ),
			wp_json_encode( $routes, JSON_HEX_TAG | JSON_UNESCAPED_SLASHES ),
			wp_json_encode( array( '@create-not-learn-editor/app-init' ), JSON_HEX_TAG | JSON_UNESCAPED_SLASHES ),
			wp_json_encode( admin_url( '/' ) )
		),
		'after'
	);

	$style_dependencies = array_filter(
		$script_deps,
		static function ( $handle ) {
			return wp_style_is( $handle, 'registered' );
		}
	);

	wp_register_style(
		'cnl-editor-prerequisites',
		false,
		$style_dependencies,
		$boot_asset['version'] ?? CNL_EDITOR_VERSION
	);

	wp_enqueue_script( 'cnl-editor-prerequisites' );
	wp_enqueue_script_module( CNL_EDITOR_SLUG );
	wp_enqueue_style( 'cnl-editor-prerequisites' );
	cnl_editor_register_lazy_editor_compat_module();

	return true;
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

/**
 * Get the Gutenberg boot module asset metadata.
 *
 * @return array Asset metadata.
 */
function cnl_editor_get_gutenberg_boot_asset() {
	$asset_file = WP_PLUGIN_DIR . '/gutenberg/build/modules/boot/index.min.asset.php';

	if ( file_exists( $asset_file ) ) {
		return require $asset_file;
	}

	return array(
		'dependencies' => array(
			'wp-components',
			'wp-core-data',
			'wp-data',
			'wp-editor',
			'wp-element',
			'wp-i18n',
			'wp-url',
		),
		'version'      => CNL_EDITOR_VERSION,
	);
}

/**
 * Get all built route module asset arrays.
 *
 * @return array[] Asset metadata.
 */
function cnl_editor_get_route_module_assets() {
	$assets = array();

	foreach ( cnl_editor_get_module_map() as $module ) {
		$asset_file = CNL_EDITOR_PATH . 'build/' . $module['path'] . '.asset.php';
		if ( file_exists( $asset_file ) ) {
			$assets[] = require $asset_file;
		}
	}

	return $assets;
}

/**
 * Register this plugin's script modules.
 *
 * @param array[] $routes Registered route definitions.
 */
function cnl_editor_register_boot_modules( $routes = null ) {
	if ( null === $routes ) {
		$routes = cnl_editor_get_routes();
	}

	foreach ( cnl_editor_get_module_map() as $module ) {
		if ( '@wordpress/lazy-editor' === $module['id'] ) {
			cnl_editor_register_lazy_editor_compat_module();
			continue;
		}
		cnl_editor_register_script_module_from_build( $module['id'], $module['path'] );
	}

	$boot_dependencies = array(
		array(
			'id'     => '@wordpress/boot',
			'import' => 'static',
		),
		array(
			'id'     => '@create-not-learn-editor/app-init',
			'import' => 'static',
		),
		// The chat panel's body and the section picker, imported once the
		// page has settled.
		array(
			'id'     => '@create-not-learn-editor/app-init-deferred',
			'import' => 'dynamic',
		),
		// The chat's bigger pickers, imported the first time one is shown.
		array(
			'id'     => '@create-not-learn-editor/chat-extras',
			'import' => 'dynamic',
		),
		// DataViews, imported the first time a screen shows a list.
		array(
			'id'     => '@create-not-learn-editor/dataviews',
			'import' => 'dynamic',
		),
	);

	// Screens that share a module list it once.
	$route_modules = array();

	foreach ( $routes as $route ) {
		if ( isset( $route['route_module'] ) ) {
			$route_modules[ $route['route_module'] ] = 'static';
		}

		if ( isset( $route['content_module'] ) && ! isset( $route_modules[ $route['content_module'] ] ) ) {
			$route_modules[ $route['content_module'] ] = 'dynamic';
		}
	}

	foreach ( $route_modules as $id => $import ) {
		$boot_dependencies[] = array(
			'id'     => $id,
			'import' => $import,
		);
	}

	/**
	 * Filters boot script-module dependencies for the full-page editor.
	 *
	 * @param array $boot_dependencies Boot dependencies for the page.
	 */
	$boot_dependencies = apply_filters(
		CNL_EDITOR_SLUG . '_boot_dependencies',
		$boot_dependencies
	);

	wp_register_script_module(
		CNL_EDITOR_SLUG,
		CNL_EDITOR_URL . 'build/pages/' . CNL_EDITOR_SLUG . '/loader.js',
		$boot_dependencies,
		CNL_EDITOR_VERSION
	);
}

/**
 * Replace Gutenberg's affected lazy editor module with the compatibility
 * wrapper after Gutenberg has registered its released package.
 */
function cnl_editor_register_lazy_editor_compat_module() {
	// Let Gutenberg register its generated module map before replacing this ID.
	wp_scripts();
	wp_deregister_script_module( '@wordpress/lazy-editor' );
	cnl_editor_register_script_module_from_build(
		'@wordpress/lazy-editor',
		'modules/lazy-editor-compat/index.min'
	);
}

/**
 * Register one built script module.
 *
 * @param string $id Module ID.
 * @param string $path Build-relative path without extension.
 */
function cnl_editor_register_script_module_from_build( $id, $path ) {
	$asset_file = CNL_EDITOR_PATH . 'build/' . $path . '.asset.php';
	$asset      = file_exists( $asset_file ) ? require $asset_file : array();
	$deps       = $asset['module_dependencies'] ?? array();

	wp_register_script_module(
		$id,
		CNL_EDITOR_URL . 'build/' . $path . '.js',
		$deps,
		$asset['version'] ?? CNL_EDITOR_VERSION
	);
}

/**
 * Enqueue the editor's web fonts.
 *
 * The black sidebar's headings are set in EB Garamond, the heading face on
 * WordPress.org, whatever the visual theme. The font ships with the plugin
 * rather than loading from a third-party CDN.
 */
function cnl_editor_enqueue_ui_theme_fonts() {
	wp_enqueue_style(
		'cnl-editor-font-eb-garamond',
		CNL_EDITOR_URL . 'assets/fonts/eb-garamond/style.css',
		array(),
		CNL_EDITOR_VERSION
	);
}

/**
 * Preload the heading font so the sidebar's headings do not flash in a
 * fallback face.
 */
function cnl_editor_print_ui_theme_font_preload() {
	printf(
		'<link rel="preload" href="%s" as="font" type="font/woff2" crossorigin>' . "\n",
		esc_url( CNL_EDITOR_URL . 'assets/fonts/eb-garamond/EBGaramond-latin.woff2' )
	);
}

/**
 * Enqueue CSS emitted by the module build.
 */
function cnl_editor_enqueue_built_styles() {
	// Stylesheets are all written under `styles/`; scripts and modules inject
	// their own CSS, so the rest of the build needn't be walked.
	$build_path = CNL_EDITOR_PATH . 'build/styles';

	if ( ! is_dir( $build_path ) ) {
		return;
	}

	$iterator = new RecursiveIteratorIterator(
		new RecursiveDirectoryIterator( $build_path, FilesystemIterator::SKIP_DOTS )
	);

	// The build writes each stylesheet four ways: plain and minified, each
	// with a right-to-left copy. Load one, and let WordPress swap in its
	// right-to-left copy when the admin is right-to-left.
	$use_minified = ! ( defined( 'SCRIPT_DEBUG' ) && SCRIPT_DEBUG );

	foreach ( $iterator as $file ) {
		if ( ! $file->isFile() || 'css' !== $file->getExtension() ) {
			continue;
		}

		$style_file = $file->getPathname();

		if ( preg_match( '/-rtl(\.min)?\.css$/', $style_file ) ) {
			continue;
		}

		$is_minified = '.min.css' === substr( $style_file, -8 );
		$base_file   = substr( $style_file, 0, $is_minified ? -8 : -4 );
		$suffix      = $is_minified ? '.min' : '';

		// Skip this one if the other version is the one to load.
		if (
			$is_minified !== $use_minified &&
			file_exists( $base_file . ( $use_minified ? '.min.css' : '.css' ) )
		) {
			continue;
		}

		$relative_path = str_replace( CNL_EDITOR_PATH . 'build/', '', $style_file );
		$relative_base = str_replace( CNL_EDITOR_PATH . 'build/', '', $base_file );
		$handle        = 'cnl-editor-' . sanitize_key( str_replace( array( '/', '.' ), '-', $relative_base ) );

		wp_enqueue_style(
			$handle,
			CNL_EDITOR_URL . 'build/' . $relative_path,
			array( 'wp-components' ),
			filemtime( $style_file )
		);

		if ( file_exists( $base_file . '-rtl' . $suffix . '.css' ) ) {
			wp_style_add_data( $handle, 'rtl', 'replace' );

			if ( $suffix ) {
				wp_style_add_data( $handle, 'suffix', $suffix );
			}
		}
	}
}

/**
 * Get the plugin script module map.
 *
 * @return array[] Module definitions.
 */
function cnl_editor_get_module_map() {
	$modules = array(
		array(
			'id'   => '@create-not-learn-editor/app-init',
			'path' => 'modules/app-init/index.min',
		),
		array(
			'id'   => '@wordpress/lazy-editor',
			'path' => 'modules/lazy-editor-compat/index.min',
		),
		array(
			'id'   => '@create-not-learn-editor/app-init-deferred',
			'path' => 'modules/app-init-deferred/index.min',
		),
		array(
			'id'   => '@create-not-learn-editor/chat-extras',
			'path' => 'modules/chat-extras/index.min',
		),
		array(
			'id'   => '@create-not-learn-editor/dataviews',
			'path' => 'modules/dataviews/index.min',
		),
		array(
			'id'   => 'create-not-learn-editor/routes/home/route',
			'path' => 'routes/home/route.min',
		),
		array(
			'id'   => 'create-not-learn-editor/routes/home/content',
			'path' => 'routes/home/content.min',
		),
		array(
			'id'   => 'create-not-learn-editor/routes/site-overview/route',
			'path' => 'routes/site-overview/route.min',
		),
		array(
			'id'   => 'create-not-learn-editor/routes/site-overview/content',
			'path' => 'routes/site-overview/content.min',
		),
		array(
			'id'   => 'create-not-learn-editor/routes/content/route',
			'path' => 'routes/content/route.min',
		),
		array(
			'id'   => 'create-not-learn-editor/routes/content/content',
			'path' => 'routes/content/content.min',
		),
		array(
			'id'   => 'create-not-learn-editor/routes/navigation/route',
			'path' => 'routes/navigation/route.min',
		),
		array(
			'id'   => 'create-not-learn-editor/routes/navigation/content',
			'path' => 'routes/navigation/content.min',
		),
		array(
			'id'   => 'create-not-learn-editor/routes/navigation-edit/route',
			'path' => 'routes/navigation-edit/route.min',
		),
		array(
			'id'   => 'create-not-learn-editor/routes/navigation-edit/content',
			'path' => 'routes/navigation-edit/content.min',
		),
		array(
			'id'   => 'create-not-learn-editor/routes/template-part-edit/route',
			'path' => 'routes/template-part-edit/route.min',
		),
		array(
			'id'   => 'create-not-learn-editor/routes/template-edit/route',
			'path' => 'routes/template-edit/route.min',
		),
		array(
			'id'   => 'create-not-learn-editor/routes/static/route',
			'path' => 'routes/static/route.min',
		),
		array(
			'id'   => 'create-not-learn-editor/routes/static/content',
			'path' => 'routes/static/content.min',
		),
		array(
			'id'   => 'create-not-learn-editor/routes/header/route',
			'path' => 'routes/header/route.min',
		),
		array(
			'id'   => 'create-not-learn-editor/routes/footer/route',
			'path' => 'routes/footer/route.min',
		),
		array(
			'id'   => 'create-not-learn-editor/routes/header-footer/route',
			'path' => 'routes/header-footer/route.min',
		),
		array(
			'id'   => 'create-not-learn-editor/routes/site-part/content',
			'path' => 'routes/site-part/content.min',
		),
		array(
			'id'   => 'create-not-learn-editor/routes/post-edit/route',
			'path' => 'routes/post-edit/route.min',
		),
		array(
			'id'   => 'create-not-learn-editor/routes/post-new/route',
			'path' => 'routes/post-new/route.min',
		),
	);

	foreach ( array( 'shop', 'shop-products', 'shop-pages' ) as $shop_route ) {
		foreach ( array( 'route', 'content' ) as $part ) {
			$modules[] = array(
				'id'   => "create-not-learn-editor/routes/{$shop_route}/{$part}",
				'path' => "routes/{$shop_route}/{$part}.min",
			);
		}
	}

	return $modules;
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
			'route_module'   => 'create-not-learn-editor/routes/navigation/route',
			'content_module' => 'create-not-learn-editor/routes/navigation/content',
		),
		array(
			'path'           => '/navigation/edit/$id',
			'route_module'   => 'create-not-learn-editor/routes/navigation-edit/route',
			'content_module' => 'create-not-learn-editor/routes/navigation-edit/content',
		),
		array(
			'path'         => '/wp_template',
			'route_module' => 'create-not-learn-editor/routes/template-edit/route',
		),
		array(
			'path'         => '/wp_template_part',
			'route_module' => 'create-not-learn-editor/routes/template-part-edit/route',
		),
		array(
			'path'           => '/media',
			'route_module'   => 'create-not-learn-editor/routes/static/route',
			'content_module' => 'create-not-learn-editor/routes/static/content',
		),
		/*
		 * Gutenberg's media editor links back to its own media list, here.
		 * The route sends it on to the Media screen. See `includes/media.php`.
		 */
		array(
			'path'         => '/types/attachment/list/$view',
			'route_module' => 'create-not-learn-editor/routes/static/route',
		),
		array(
			'path'           => '/design',
			'route_module'   => 'create-not-learn-editor/routes/static/route',
			'content_module' => 'create-not-learn-editor/routes/static/content',
		),
		array(
			'path'           => '/design/colors',
			'route_module'   => 'create-not-learn-editor/routes/static/route',
			'content_module' => 'create-not-learn-editor/routes/static/content',
		),
		array(
			'path'           => '/design/fonts',
			'route_module'   => 'create-not-learn-editor/routes/static/route',
			'content_module' => 'create-not-learn-editor/routes/static/content',
		),
		array(
			'path'           => '/design/identity',
			'route_module'   => 'create-not-learn-editor/routes/static/route',
			'content_module' => 'create-not-learn-editor/routes/static/content',
		),
		array(
			'path'           => '/design/header-footer',
			'route_module'   => 'create-not-learn-editor/routes/header-footer/route',
			'content_module' => 'create-not-learn-editor/routes/site-part/content',
		),
		array(
			'path'           => '/design/header',
			'route_module'   => 'create-not-learn-editor/routes/header/route',
			'content_module' => 'create-not-learn-editor/routes/site-part/content',
		),
		array(
			'path'           => '/design/footer',
			'route_module'   => 'create-not-learn-editor/routes/footer/route',
			'content_module' => 'create-not-learn-editor/routes/site-part/content',
		),
		array(
			'path'           => '/patterns',
			'route_module'   => 'create-not-learn-editor/routes/static/route',
			'content_module' => 'create-not-learn-editor/routes/static/content',
		),
		array(
			'path'           => '/template-parts',
			'route_module'   => 'create-not-learn-editor/routes/static/route',
			'content_module' => 'create-not-learn-editor/routes/static/content',
		),
		array(
			'path'           => '/templates',
			'route_module'   => 'create-not-learn-editor/routes/static/route',
			'content_module' => 'create-not-learn-editor/routes/static/content',
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
			);
			continue;
		}

		$items[] = array(
			'id'      => 'page' === $post_type['name'] ? 'pages' : 'content-' . $post_type['name'],
			'icon'    => $post_type['menuIcon'],
			'label'   => $post_type['menuName'],
			// The route prefix, not a specific list view: switching tabs or
			// filters within the list (or editing/creating an item) changes
			// the URL past this point, and the sidebar's drilldown-restoration
			// logic matches by longest `to` prefix, so this must cover every
			// URL under this post type for the drilldown to stay open.
			'to'      => '/types/' . $post_type['name'],
			'section' => 'content',
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
				'id'      => 'site-overview',
				'icon'    => 'dashicons-networking',
				'label'   => __( 'Site Overview', 'create-not-learn-editor' ),
				'to'      => '/site-overview',
				'section' => 'site',
			),
			// The main menu is managed on the Pages screen; this is for the rest.
			array(
				'id'      => 'navigation',
				'label'   => __( 'Menus', 'create-not-learn-editor' ),
				'to'      => '/navigation',
				'section' => 'site',
			),
			array(
				'id'      => 'identity',
				'icon'    => 'dashicons-id',
				'label'   => __( 'Site Identity', 'create-not-learn-editor' ),
				'to'      => '/design/identity',
				'section' => 'site',
			),
			array(
				'id'      => 'media',
				'icon'    => 'dashicons-admin-media',
				'label'   => __( 'Media', 'create-not-learn-editor' ),
				'to'      => '/media',
				'section' => 'site',
			),
			// The Design screen itself is reached from Home's "Colors & fonts".
			array(
				'id'      => 'colors',
				'icon'    => 'dashicons-art',
				'label'   => __( 'Colors', 'create-not-learn-editor' ),
				'to'      => '/design/colors',
				'section' => 'design',
			),
			array(
				'id'      => 'fonts',
				'icon'    => 'dashicons-editor-textcolor',
				'label'   => __( 'Fonts', 'create-not-learn-editor' ),
				'to'      => '/design/fonts',
				'section' => 'design',
			),
		),
		// Plugins: those that add to the site, each leading to its screens.
		cnl_editor_get_shop_extension_menu_items(),
		array(
			array(
				'id'      => 'patterns',
				'label'   => __( 'Patterns', 'create-not-learn-editor' ),
				'to'      => '/patterns',
				'section' => 'advanced',
			),
			array(
				'id'      => 'templateParts',
				'label'   => __( 'Site parts', 'create-not-learn-editor' ),
				'to'      => '/template-parts',
				'section' => 'advanced',
			),
			array(
				'id'      => 'templates',
				'label'   => __( 'Templates', 'create-not-learn-editor' ),
				'to'      => '/templates',
				'section' => 'advanced',
			),
		)
	);
}
