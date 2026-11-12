<?php
/**
 * The admin bar above the full-page editor.
 *
 * WordPress shows the admin bar on every admin screen, and Gutenberg's
 * site-editor-v2 shows it above its editor too, so it shows here as well and
 * stays put moving between wp-admin and the editor. Where the bar and the
 * editor would offer the same thing twice, the editor's own wins: the bar's
 * search opens the editor's command palette (`src/admin-bar.js`), and its New
 * menu's pages, posts and other content open the editor's add flows rather
 * than wp-admin's. New itself only opens its menu, and adding a user is left
 * to wp-admin's Users screen.
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
 * Set the admin bar up above the editor.
 *
 * Call after the page's queues are cleared, as it enqueues the bar's assets.
 *
 * @return bool Whether the admin bar is rendered.
 */
function cnl_editor_enable_admin_bar() {
	if ( ! is_admin_bar_showing() ) {
		return false;
	}

	add_action( 'admin_bar_menu', 'cnl_editor_admin_bar_command_palette', 56 );
	// Late, after every plugin has added to New, so its items are there to change.
	add_action( 'admin_bar_menu', 'cnl_editor_admin_bar_new_content', PHP_INT_MAX );

	wp_enqueue_script( 'admin-bar' );
	wp_enqueue_style( 'admin-bar' );
	wp_enqueue_style( 'colors' );

	$css = <<<CSS
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
 * Lead the bar's New menu into the editor.
 *
 * Each kind of content the editor lists opens that list's add flow, by
 * asking the list to add one (`?add=1`, see `src/routes/content/content.jsx`),
 * and `src/admin-bar.js` opens it in place. Media opens the editor's upload
 * modal, also from `src/admin-bar.js`. User comes off, as adding people isn't
 * something this editor does.
 *
 * New itself goes nowhere, so a click on it only opens its menu (see
 * `src/admin-bar.js`). Core points it at the first item, which would leave
 * the editor for wp-admin.
 *
 * @param WP_Admin_Bar $wp_admin_bar The admin bar.
 */
function cnl_editor_admin_bar_new_content( WP_Admin_Bar $wp_admin_bar ) {
	if ( ! $wp_admin_bar->get_node( 'new-content' ) ) {
		return;
	}

	$wp_admin_bar->remove_node( 'new-user' );

	// Someone who could only add users has nothing left in the menu.
	$items = wp_list_filter( (array) $wp_admin_bar->get_nodes(), array( 'parent' => 'new-content' ) );

	if ( ! $items ) {
		$wp_admin_bar->remove_node( 'new-content' );
		return;
	}

	foreach ( cnl_editor_get_content_post_types() as $post_type ) {
		$id = 'new-' . $post_type->name;

		if ( ! $wp_admin_bar->get_node( $id ) ) {
			continue;
		}

		$wp_admin_bar->add_node(
			array(
				'id'   => $id,
				'href' => add_query_arg(
					array(
						'page' => 'create-not-learn-editor',
						'p'    => rawurlencode( '/types/' . $post_type->name . '/list/all?add=1' ),
					),
					admin_url( 'admin.php' )
				),
			)
		);
	}

	$wp_admin_bar->add_node(
		array(
			'id'   => 'new-content',
			'href' => '#',
		)
	);
}
