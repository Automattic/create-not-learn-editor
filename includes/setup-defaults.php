<?php
/**
 * The site's menu, made on every editor visit, and the explicit setup action.
 *
 * @package CreateNotLearnEditor
 */

defined( 'ABSPATH' ) || exit;

/**
 * The option row that stops two requests making a fallback menu at once.
 */
const CNL_EDITOR_NAVIGATION_LOCK = 'cnl_editor_navigation_fallback_lock';

/**
 * Register hooks for the defaults WordPress makes by itself.
 */
function cnl_editor_register_setup_default_hooks() {
	add_filter( 'wp_navigation_should_create_fallback', 'cnl_editor_lock_fallback_navigation_menu', PHP_INT_MAX );
	add_filter( 'wp_navigation_should_create_fallback', 'cnl_editor_watch_for_fallback_navigation_menu', PHP_INT_MAX );
}

/**
 * Let one request at a time make WordPress's fallback menu.
 *
 * `WP_Navigation_Fallback::get_fallback()` looks for a menu and makes one if
 * there is none, with nothing to stop two requests doing both at once. The
 * editor's first visit, the Navigation block's REST fallback and the block's
 * front-end render can all get there together on a new site, which left it
 * with two menus. WordPress asks this filter before it looks, so a request
 * holding the lock looks after any other has finished making its menu.
 *
 * @param bool $should_create Whether WordPress may make a menu.
 * @return bool Whether WordPress may make a menu.
 */
function cnl_editor_lock_fallback_navigation_menu( $should_create ) {
	if ( ! $should_create || cnl_editor_holds_navigation_lock() ) {
		return $should_create;
	}

	/**
	 * Filters how long, in seconds, a request waits for another to finish
	 * making the fallback menu before it gives up without making one.
	 *
	 * @param int $seconds Seconds to wait.
	 */
	$deadline = microtime( true ) + (int) apply_filters( CNL_EDITOR_SLUG . '_navigation_lock_wait', 5 );

	while ( ! cnl_editor_acquire_navigation_lock() ) {
		// Another request is making the menu; once it has, WordPress finds it.
		if ( cnl_editor_has_published_navigation_menu() || microtime( true ) >= $deadline ) {
			return false;
		}

		usleep( 100000 );
	}

	return true;
}

/**
 * Whether this request holds the fallback menu lock.
 *
 * @param bool|null $held Set whether it does, or null to only ask.
 * @return bool Whether it does.
 */
function cnl_editor_holds_navigation_lock( $held = null ) {
	static $holds = false;

	if ( null !== $held ) {
		$holds = $held;
	}

	return $holds;
}

/**
 * Take the fallback menu lock.
 *
 * An option row is the lock, inserted with `INSERT IGNORE` as
 * `WP_Upgrader::create_lock()` does, so only one request can add it. It is
 * read and written straight from the table, never through the options cache,
 * which another request's change would not reach.
 *
 * @return bool Whether this request now holds the lock.
 */
function cnl_editor_acquire_navigation_lock() {
	global $wpdb;

	if ( cnl_editor_holds_navigation_lock() ) {
		return true;
	}

	$now = (string) time();

	// phpcs:disable WordPress.DB.DirectDatabaseQuery -- A lock has to skip the options cache.
	$acquired = (bool) $wpdb->query(
		$wpdb->prepare(
			"INSERT IGNORE INTO `$wpdb->options` ( `option_name`, `option_value`, `autoload` ) VALUES ( %s, %s, 'off' )",
			CNL_EDITOR_NAVIGATION_LOCK,
			$now
		)
	);

	if ( ! $acquired ) {
		$locked_at = $wpdb->get_var(
			$wpdb->prepare( "SELECT option_value FROM `$wpdb->options` WHERE option_name = %s", CNL_EDITOR_NAVIGATION_LOCK )
		);

		// A request that died holding the lock leaves it behind. Take over a
		// stale one only if no other request has just done the same.
		if ( null !== $locked_at && (int) $locked_at < time() - 30 ) {
			$acquired = (bool) $wpdb->query(
				$wpdb->prepare(
					"UPDATE `$wpdb->options` SET option_value = %s WHERE option_name = %s AND option_value = %s",
					$now,
					CNL_EDITOR_NAVIGATION_LOCK,
					$locked_at
				)
			);
		}
	}
	// phpcs:enable WordPress.DB.DirectDatabaseQuery

	if ( $acquired ) {
		cnl_editor_holds_navigation_lock( true );
		// WordPress has no hook after it decides, so a lock taken for its own
		// fallback is let go when the request ends, or once the menu is made.
		add_action( 'wp_after_insert_post', 'cnl_editor_release_navigation_lock_after_insert', 10, 2 );
		add_action( 'shutdown', 'cnl_editor_release_navigation_lock' );
	}

	return $acquired;
}

/**
 * Let go of the fallback menu lock once a menu has been made.
 *
 * @param int     $post_id Post ID.
 * @param WP_Post $post    Post object.
 */
function cnl_editor_release_navigation_lock_after_insert( $post_id, $post ) {
	if ( 'wp_navigation' === $post->post_type ) {
		cnl_editor_release_navigation_lock();
	}
}

/**
 * Let go of the fallback menu lock, if this request holds it.
 */
function cnl_editor_release_navigation_lock() {
	global $wpdb;

	if ( ! cnl_editor_holds_navigation_lock() ) {
		return;
	}

	$wpdb->delete( $wpdb->options, array( 'option_name' => CNL_EDITOR_NAVIGATION_LOCK ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
	cnl_editor_holds_navigation_lock( false );
	remove_action( 'wp_after_insert_post', 'cnl_editor_release_navigation_lock_after_insert', 10 );
	remove_action( 'shutdown', 'cnl_editor_release_navigation_lock' );
}

/**
 * Whether a published menu exists, read past the query cache, which another
 * request's new menu would not reach.
 *
 * @return bool Whether one does.
 */
function cnl_editor_has_published_navigation_menu() {
	global $wpdb;

	// phpcs:ignore WordPress.DB.DirectDatabaseQuery
	return (bool) $wpdb->get_var(
		$wpdb->prepare( "SELECT ID FROM `$wpdb->posts` WHERE post_type = %s AND post_status = %s LIMIT 1", 'wp_navigation', 'publish' )
	);
}

/**
 * Name the menu WordPress makes for a site with none "Main menu".
 *
 * When a Navigation block has no menu and the site has none, WordPress makes
 * one listing the pages, titled "Navigation". That reads as the block's name,
 * not a menu's, so it is named as the editor's own menus are. WordPress asks
 * this filter just before it decides whether to make the menu, and has no
 * hook after, so the rename waits for the next menu inserted with the title
 * and slug WordPress gives it.
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
 * Make sure the site has a menu to edit.
 *
 * Runs on every editor visit as well as in the setup action, so a menu is
 * there on the server before anything asks for one. It goes through
 * WordPress's own fallback, the one the Navigation block uses, so the two
 * pick the same menu and never make one each: it reuses the latest published
 * menu, then converts a classic menu, and only then makes one listing the
 * pages. See docs/architecture.md.
 *
 * @return array {
 *     @type bool $created Whether this call made the menu.
 *     @type int  $id      The menu found or made, or 0 if there was already
 *                         a menu or none could be had.
 * }
 */
function cnl_editor_ensure_default_navigation_menu() {
	$result = array(
		'created' => false,
		'id'      => 0,
	);

	// The cheap check that makes every visit after the first a no-op.
	if ( cnl_editor_has_navigation_menu() ) {
		return $result;
	}

	// Making a menu is for people who may, as core's fallback endpoint asks.
	$post_type = get_post_type_object( 'wp_navigation' );

	if ( ! $post_type || ! current_user_can( $post_type->cap->create_posts ) || ! class_exists( 'WP_Navigation_Fallback' ) ) {
		return $result;
	}

	$created = 0;
	$watch   = static function ( $post_id, $post, $update ) use ( &$created ) {
		if ( ! $update && 'wp_navigation' === $post->post_type ) {
			$created = (int) $post_id;
		}
	};

	add_action( 'wp_after_insert_post', $watch, 10, 3 );
	$fallback = WP_Navigation_Fallback::get_fallback();
	remove_action( 'wp_after_insert_post', $watch, 10 );

	// Let go now rather than at the end of the page, and stop watching for
	// a menu to rename if WordPress found one rather than making it.
	cnl_editor_release_navigation_lock();
	remove_filter( 'wp_insert_post_data', 'cnl_editor_name_fallback_navigation_menu', 10 );

	if ( $fallback instanceof WP_Post && 'wp_navigation' === $fallback->post_type ) {
		$result['id']      = (int) $fallback->ID;
		$result['created'] = $created === $result['id'];
	}

	return $result;
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
