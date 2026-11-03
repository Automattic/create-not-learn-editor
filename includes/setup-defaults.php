<?php
/**
 * Explicit site setup actions.
 *
 * @package CreateNotLearnEditor
 */

defined( 'ABSPATH' ) || exit;

/**
 * Register hooks for the defaults WordPress makes by itself.
 */
function cnl_editor_register_setup_default_hooks() {
	add_filter( 'wp_navigation_should_create_fallback', 'cnl_editor_watch_for_fallback_navigation_menu', PHP_INT_MAX );
}

/**
 * Name the menu WordPress makes for a site with none "Main menu".
 *
 * When a Navigation block has no menu and the site has none, WordPress makes
 * one listing the pages, titled "Navigation". That reads as the block's name,
 * not a menu's, so it is named as the setup action and the demo site name
 * theirs. WordPress asks this filter just before it decides whether to make
 * the menu, and has no hook after, so the rename waits for the next menu
 * inserted with the title and slug WordPress gives it.
 *
 * @param bool $should_create Whether WordPress may make a menu.
 * @return bool Whether WordPress may make a menu, untouched.
 */
function cnl_editor_watch_for_fallback_navigation_menu( $should_create ) {
	if ( $should_create ) {
		add_filter( 'wp_insert_post_data', 'cnl_editor_name_fallback_navigation_menu', 10, 4 );
	}

	return $should_create;
}

/**
 * Rename WordPress's fallback menu as it is inserted. Menus made any other
 * way, and changes to existing ones, are left as they are.
 *
 * @param array $data                Slashed post data to insert.
 * @param array $postarr             Sanitised post data passed in.
 * @param array $unsanitized_postarr Post data passed in.
 * @param bool  $update              Whether an existing post is being updated.
 * @return array Post data to insert.
 */
function cnl_editor_name_fallback_navigation_menu( $data, $postarr, $unsanitized_postarr, $update ) {
	if (
		$update ||
		'wp_navigation' !== $data['post_type'] ||
		// The slug WordPress asks for, before it is made unique.
		'navigation' !== ( $unsanitized_postarr['post_name'] ?? '' ) ||
		wp_slash( _x( 'Navigation', 'Title of a Navigation menu' ) ) !== $data['post_title'] // phpcs:ignore WordPress.WP.I18n.TextDomainMismatch -- WordPress's own title, to match it.
	) {
		return $data;
	}

	remove_filter( 'wp_insert_post_data', 'cnl_editor_name_fallback_navigation_menu', 10 );

	$data['post_title'] = wp_slash( __( 'Main menu', 'create-not-learn-editor' ) );
	$data['post_name']  = wp_unique_post_slug( 'main-menu', 0, $data['post_status'], 'wp_navigation', 0 );

	return $data;
}

/**
 * Get or create the page used by the explicit setup flow as the static homepage.
 *
 * @return int Home page ID, or 0 if it could not be created.
 */
function cnl_editor_get_or_create_home_page() {
	$home_page = get_page_by_path( 'home', OBJECT, 'page' );

	if ( ! $home_page ) {
		$home_pages = get_posts(
			array(
				'fields'         => 'ids',
				'order'          => 'ASC',
				'orderby'        => 'ID',
				'post_status'    => 'any',
				'post_type'      => 'page',
				'posts_per_page' => 1,
				'title'          => 'Home',
			)
		);

		if ( ! empty( $home_pages ) ) {
			$home_page = get_post( (int) $home_pages[0] );
		}
	}

	if ( $home_page ) {
		if ( 'publish' !== $home_page->post_status ) {
			wp_update_post(
				array(
					'ID'          => $home_page->ID,
					'post_status' => 'publish',
				)
			);
		}

		return (int) $home_page->ID;
	}

	$home_page_id = wp_insert_post(
		array(
			'post_name'    => 'home',
			'post_status'  => 'publish',
			'post_title'   => 'Home',
			'post_type'    => 'page',
			'post_content' => '',
		),
		true
	);

	if ( is_wp_error( $home_page_id ) ) {
		return 0;
	}

	return (int) $home_page_id;
}

/**
 * Check whether the site already has an editable Navigation menu.
 *
 * @return bool Whether a navigation menu post exists.
 */
function cnl_editor_has_navigation_menu() {
	$navigation_menus = get_posts(
		array(
			'fields'         => 'ids',
			'no_found_rows'  => true,
			'post_status'    => array( 'publish', 'draft' ),
			'post_type'      => 'wp_navigation',
			'posts_per_page' => 1,
		)
	);

	return ! empty( $navigation_menus );
}

/**
 * Ensure a basic editable Navigation menu exists.
 *
 * @return array Navigation setup result.
 */
function cnl_editor_ensure_default_navigation_menu() {
	if ( cnl_editor_has_navigation_menu() ) {
		return array(
			'created' => false,
			'id'      => 0,
		);
	}

	if ( class_exists( 'WP_Navigation_Fallback' ) && method_exists( 'WP_Navigation_Fallback', 'get_fallback' ) ) {
		$fallback_navigation = WP_Navigation_Fallback::get_fallback();

		if (
			$fallback_navigation instanceof WP_Post &&
			'wp_navigation' === $fallback_navigation->post_type
		) {
			return array(
				'created' => false,
				'id'      => (int) $fallback_navigation->ID,
			);
		}
	}

	if ( cnl_editor_has_navigation_menu() ) {
		return array(
			'created' => false,
			'id'      => 0,
		);
	}

	$navigation_id = wp_insert_post(
		array(
			'post_content' => '<!-- wp:page-list /-->',
			'post_name'    => 'main-menu',
			'post_status'  => 'publish',
			'post_title'   => __( 'Main menu', 'create-not-learn-editor' ),
			'post_type'    => 'wp_navigation',
		),
		true
	);

	return array(
		'created' => ! is_wp_error( $navigation_id ),
		'id'      => is_wp_error( $navigation_id ) ? 0 : (int) $navigation_id,
	);
}

/**
 * Run the explicit setup action.
 *
 * @return array Setup result.
 */
function cnl_editor_setup_site_defaults() {
	$home_page_id = cnl_editor_get_or_create_home_page();

	if ( ! $home_page_id ) {
		return array(
			'success' => false,
			'message' => __( 'A Home page could not be created.', 'create-not-learn-editor' ),
		);
	}

	update_option( 'show_on_front', 'page' );
	update_option( 'page_on_front', $home_page_id );
	update_option( 'page_for_posts', 0 );

	$navigation = cnl_editor_ensure_default_navigation_menu();

	return array(
		'success'           => true,
		'homePageId'        => $home_page_id,
		'showOnFront'       => get_option( 'show_on_front' ),
		'pageOnFront'       => (int) get_option( 'page_on_front' ),
		'pageForPosts'      => (int) get_option( 'page_for_posts' ),
		'navigationCreated' => (bool) $navigation['created'],
		'navigationId'      => (int) $navigation['id'],
	);
}
