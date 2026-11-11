<?php
/**
 * Scripts, script modules, styles and preloaded data for the full-page editor.
 *
 * @package CreateNotLearnEditor
 */

defined( 'ABSPATH' ) || exit;

/**
 * Register editor asset hooks.
 */
function cnl_editor_register_editor_asset_hooks() {
	add_action( CNL_EDITOR_SLUG . '_init', 'cnl_editor_enqueue_latex_to_mathml_loader' );
}

/**
 * Let the Math block load what it renders with.
 *
 * The block imports `@wordpress/latex-to-mathml` when it shows, which only
 * works if the module is in the page's import map. Gutenberg puts it there
 * from `enqueue_block_editor_assets`, which this page doesn't fire, as its
 * editor loads later on, so it is enqueued here instead.
 */
function cnl_editor_enqueue_latex_to_mathml_loader() {
	wp_enqueue_script_module( '@wordpress/latex-to-mathml/loader' );
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
 * Get the Gutenberg boot module asset metadata.
 *
 * @return array Asset metadata.
 */
function cnl_editor_get_gutenberg_boot_asset() {
	$asset_file = cnl_editor_get_gutenberg_path( 'build/modules/boot/index.min.asset.php' );

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
		// The section picker, imported once the page has settled.
		array(
			'id'     => '@create-not-learn-editor/app-init-deferred',
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
