<?php
/**
 * The admin bar above the full-page editor.
 *
 * WordPress shows the admin bar on every admin screen, and Gutenberg's
 * site-editor-v2 shows it above its editor too, so it shows here as well and
 * stays put moving between wp-admin and the editor. Where the bar and the
 * editor would offer the same thing twice, the editor's own wins: the bar's
 * search opens the editor's command palette (`src/admin-bar.js`), and its New
 * menu is taken off, as the top bar's quick add does that job.
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

	// The bar's menu toggle opens wp-admin's menu, which this page doesn't have.
	remove_action( 'admin_bar_menu', 'wp_admin_bar_sidebar_toggle', 0 );
	add_action( 'admin_bar_menu', 'cnl_editor_admin_bar_command_palette', 56 );
	// Late, after every plugin has added to New, so its items go with it.
	add_action( 'admin_bar_menu', 'cnl_editor_admin_bar_remove_new_content', PHP_INT_MAX );

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
 * Take New off the bar. The top bar's quick add is the editor's way to add
 * something, so the bar's would only offer it twice.
 *
 * @param WP_Admin_Bar $wp_admin_bar The admin bar.
 */
function cnl_editor_admin_bar_remove_new_content( WP_Admin_Bar $wp_admin_bar ) {
	$wp_admin_bar->remove_node( 'new-content' );
}
