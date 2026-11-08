<?php
/**
 * The parts of running a blog that stay in WP Admin, for Home to link to.
 *
 * Moderating comments, sorting posts into categories and the rest of the
 * settings are behind the scenes, so Home opens WP Admin for them in a new
 * tab rather than copying its screens, as the shop does for orders and
 * payments. A workspace picks which to show
 * (`home.adminLinks` in `src/workspaces/presets.js`).
 *
 * @package CreateNotLearnEditor
 */

defined( 'ABSPATH' ) || exit;

/**
 * The WP Admin screens Home can link to, and what is waiting on them.
 *
 * A screen this user can't use is left out, so Home never offers it.
 *
 * @return array{adminUrls: array<string, string>, pendingComments: int}
 */
function cnl_editor_get_blog_admin_settings() {
	$can_moderate = current_user_can( 'moderate_comments' );

	$admin_urls = array(
		'comments'   => $can_moderate ? admin_url( 'edit-comments.php' ) : null,
		'categories' => current_user_can( 'manage_categories' )
			? admin_url( 'edit-tags.php?taxonomy=category' )
			: null,
		// Every other setting, one link rather than a row each.
		'settings'   => current_user_can( 'manage_options' ) ? admin_url( 'options-general.php' ) : null,
	);

	return array(
		'adminUrls'       => array_filter( $admin_urls ),
		// The editor fetches it again when it's looked at, as comments are
		// usually approved in another tab. See `src/routes/home/blog-admin.jsx`.
		'pendingComments' => $can_moderate ? (int) wp_count_comments()->moderated : 0,
	);
}
