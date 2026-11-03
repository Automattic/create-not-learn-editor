<?php
/**
 * The admin bar above the full-page editor, for those who turn it on.
 *
 * WordPress shows the admin bar on every admin screen, and Gutenberg's
 * site-editor-v2 shows it above its editor too. The "Show the admin bar"
 * preference does the same here, so the bar stays put moving between
 * wp-admin and the editor. It's off by default. The bar is always rendered
 * and only shown while the body has the `admin-bar` class, so the editor can
 * turn it on and off without reloading (`src/admin-bar.js`). Where the bar and the
 * editor would offer the same thing twice, the bar's version leads into the
 * editor's own: its search opens the editor's command palette, and its New
 * page and New post open the editor's add flows rather than wp-admin's.
 *
 * @package CreateNotLearnEditor
 */

defined( 'ABSPATH' ) || exit;

/**
 * Get the admin colour scheme class wp-admin puts on its body.
 *
 * @return string Admin colour scheme class.
 */
function cnl_editor_get_admin_color_class() {
	$admin_color = get_user_option( 'admin_color' );

	return 'admin-color-' . sanitize_html_class( $admin_color ? $admin_color : 'fresh' );
}

/**
 * Check whether the user has turned on the admin bar in the editor.
 *
 * The preference is one of the editor's own, kept with core's preferences in
 * user meta.
 *
 * @return bool Whether the preference is on.
 */
function cnl_editor_user_shows_admin_bar() {
	global $wpdb;

	$preferences = get_user_meta( get_current_user_id(), $wpdb->get_blog_prefix() . 'persisted_preferences', true );

	return ! empty( $preferences[ CNL_EDITOR_SLUG ]['showAdminBar'] );
}

/**
 * Get an editor URL that opens a screen.
 *
 * @param string $path Route path, with any search params.
 * @return string Editor URL.
 */
function cnl_editor_get_screen_url( $path ) {
	return add_query_arg(
		array(
			'page' => CNL_EDITOR_SLUG,
			'p'    => rawurlencode( $path ),
		),
		admin_url( 'admin.php' )
	);
}

/**
 * Set the admin bar up above the editor, hidden until it's turned on.
 *
 * Call after the page's queues are cleared, as it enqueues the bar's assets.
 *
 * @return bool Whether the admin bar is rendered.
 */
function cnl_editor_enable_admin_bar() {
	if ( ! is_admin_bar_showing() ) {
		return false;
	}

	// The bar's menu toggle opens wp-admin's menu, which this page doesn't have.
	remove_action( 'admin_bar_menu', 'wp_admin_bar_sidebar_toggle', 0 );
	add_action( 'admin_bar_menu', 'cnl_editor_admin_bar_command_palette', 56 );
	add_action( 'admin_bar_menu', 'cnl_editor_admin_bar_new_content', 100 );

	wp_enqueue_script( 'admin-bar' );
	wp_enqueue_style( 'admin-bar' );
	wp_enqueue_style( 'colors' );

	$css = <<<CSS
body:not(.admin-bar) #wpadminbar {
	display: none;
}

body.admin-bar #create-not-learn-editor-app {
	position: fixed;
	inset: var(--wp-admin--admin-bar--height, 0) 0 0;
	height: auto !important;
}

@media (min-width: 782px) {
	body:has(.editor-editor-interface.is-distraction-free) {
		--wp-admin--admin-bar--height: 0px;
	}

	body:has(.editor-editor-interface.is-distraction-free) #wpadminbar {
		display: none;
	}
}
CSS;

	wp_add_inline_style( 'admin-bar', $css );

	return true;
}

/**
 * Add the bar's command palette button.
 *
 * Core only adds it when its own palette is on the page. This page mounts the
 * editor's palette instead, so the button is added here, and the editor opens
 * its palette when it's clicked.
 *
 * @param WP_Admin_Bar $wp_admin_bar The admin bar.
 */
function cnl_editor_admin_bar_command_palette( WP_Admin_Bar $wp_admin_bar ) {
	if ( $wp_admin_bar->get_node( 'command-palette' ) ) {
		return;
	}

	$user_agent = isset( $_SERVER['HTTP_USER_AGENT'] ) ? sanitize_text_field( wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) ) : '';
	$shortcut   = preg_match( '/Macintosh|Mac OS X|Mac_PowerPC/i', $user_agent )
		? _x( '⌘K', 'keyboard shortcut to open the command palette', 'create-not-learn-editor' )
		: _x( 'Ctrl+K', 'keyboard shortcut to open the command palette', 'create-not-learn-editor' );

	$wp_admin_bar->add_node(
		array(
			'id'    => 'command-palette',
			'title' => sprintf(
				'<span class="ab-icon" aria-hidden="true"></span><span class="ab-label"><kbd>%s</kbd><span class="screen-reader-text"> %s</span></span>',
				esc_html( $shortcut ),
				esc_html__( 'Open command palette', 'create-not-learn-editor' )
			),
			'href'  => '#',
			'meta'  => array( 'class' => 'hide-if-no-js' ),
		)
	);
}

/**
 * Point the bar's New post and New page at the editor's add flows.
 *
 * @param WP_Admin_Bar $wp_admin_bar The admin bar.
 */
function cnl_editor_admin_bar_new_content( WP_Admin_Bar $wp_admin_bar ) {
	$links = array(
		'new-post' => cnl_editor_get_screen_url( '/types/post/list/all?add=1' ),
		'new-page' => cnl_editor_get_screen_url( '/types/page/list/all?add=1' ),
	);

	foreach ( $links as $id => $href ) {
		if ( $wp_admin_bar->get_node( $id ) ) {
			$wp_admin_bar->add_node(
				array(
					'id'   => $id,
					'href' => $href,
				)
			);
		}
	}

	// The bar's New itself adds a post.
	$new_content = $wp_admin_bar->get_node( 'new-content' );
	if ( $new_content && $wp_admin_bar->get_node( 'new-post' ) ) {
		$wp_admin_bar->add_node(
			array(
				'id'   => 'new-content',
				'href' => $links['new-post'],
			)
		);
	}
}
