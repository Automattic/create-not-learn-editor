<?php
/**
 * Autosaves and post locks for the posts the editor opens.
 *
 * Core's post editor gets both from `wp-admin/edit-form-blocks.php`, which
 * locks the post and puts the lock, and any newer autosave, in the editor
 * settings it prints. The editor here loads its settings from the REST API,
 * which has neither, and moves between posts without loading a page, so the
 * client asks for them here each time it opens a post. See
 * `docs/architecture.md`.
 *
 * @package CreateNotLearnEditor
 */

defined( 'ABSPATH' ) || exit;

/**
 * Register post safety hooks.
 */
function cnl_editor_register_post_safety_hooks() {
	add_action( 'rest_api_init', 'cnl_editor_register_post_safety_routes' );
	add_action( 'load-post.php', 'cnl_editor_return_after_post_lock_takeover' );
}

/**
 * Register the post safety REST routes.
 */
function cnl_editor_register_post_safety_routes() {
	$id_arg = array(
		'id' => array(
			'type'     => 'integer',
			'required' => true,
		),
	);

	register_rest_route(
		CNL_EDITOR_REST_NAMESPACE,
		'/post-lock/(?P<id>\d+)',
		array(
			'methods'             => WP_REST_Server::CREATABLE,
			'callback'            => 'cnl_editor_rest_open_post',
			'permission_callback' => 'cnl_editor_rest_can_edit_post',
			'args'                => $id_arg,
		)
	);

	register_rest_route(
		CNL_EDITOR_REST_NAMESPACE,
		'/autosave/(?P<id>\d+)',
		array(
			'methods'             => WP_REST_Server::DELETABLE,
			'callback'            => 'cnl_editor_rest_delete_autosave',
			'permission_callback' => 'cnl_editor_rest_can_edit_post',
			'args'                => $id_arg,
		)
	);
}

/**
 * Whether the current user can edit the post a request is about.
 *
 * @param WP_REST_Request $request The request.
 * @return bool Whether they can.
 */
function cnl_editor_rest_can_edit_post( $request ) {
	$post = get_post( (int) $request['id'] );

	return $post && current_user_can( 'edit_post', $post->ID );
}

/**
 * Whether a post is autosaved and locked while it is edited.
 *
 * Core does both for whatever its post editor opens, the post types edited at
 * `post.php`, and neither for what the site editor opens, like templates,
 * template parts and menus.
 *
 * @param WP_Post $post The post.
 * @return bool Whether it is.
 */
function cnl_editor_post_has_safety( $post ) {
	$post_type = get_post_type_object( $post->post_type );
	$edit_link = $post_type ? (string) $post_type->_edit_link : '';

	/**
	 * Filters whether a post is autosaved and locked while the editor has it
	 * open.
	 *
	 * @param bool    $has_safety Whether it is. By default, when the post's type
	 *                            is edited in core's post editor.
	 * @param WP_Post $post       The post.
	 */
	return (bool) apply_filters(
		CNL_EDITOR_SLUG . '_has_post_safety',
		0 === strpos( ltrim( $edit_link, '/' ), 'post.php' ),
		$post
	);
}

/**
 * Lock a post for the current user, unless someone else has it, as core's
 * post editor does on opening one.
 *
 * Mirrors the "Lock settings" in `wp-admin/edit-form-blocks.php`.
 *
 * @param WP_Post $post The post.
 * @return array The `postLock` editor setting.
 */
function cnl_editor_lock_post( $post ) {
	require_once ABSPATH . 'wp-admin/includes/post.php';

	$user_id = wp_check_post_lock( $post->ID );

	if ( ! $user_id ) {
		$active_post_lock = wp_set_post_lock( $post->ID );

		return array(
			'isLocked'       => false,
			'activePostLock' => $active_post_lock ? esc_attr( implode( ':', $active_post_lock ) ) : false,
		);
	}

	/** This filter is documented in wp-admin/includes/post.php */
	$locked = (bool) apply_filters( 'show_post_locked_dialog', true, $post, $user_id );

	$user_details = null;
	if ( $locked ) {
		$user         = get_userdata( $user_id );
		$user_details = array( 'name' => $user ? $user->display_name : '' );

		if ( get_option( 'show_avatars' ) ) {
			$user_details['avatar'] = get_avatar_url( $user_id, array( 'size' => 128 ) );
		}
	}

	return array(
		'isLocked' => $locked,
		'user'     => $user_details,
	);
}

/**
 * The current user's autosave of a post, if it is newer than the post.
 *
 * Core's post editor offers any newer autosave. Only the current user's is
 * offered here, as it is what their own editor would restore.
 *
 * @param WP_Post $post The post.
 * @return array|null The autosave's ID and fields, or null.
 */
function cnl_editor_get_newer_autosave( $post ) {
	$autosave = wp_get_post_autosave( $post->ID, get_current_user_id() );

	if ( ! $autosave || strtotime( $autosave->post_modified_gmt ) <= strtotime( $post->post_modified_gmt ) ) {
		return null;
	}

	return array(
		'id'      => $autosave->ID,
		'title'   => $autosave->post_title,
		'content' => $autosave->post_content,
		'excerpt' => $autosave->post_excerpt,
	);
}

/**
 * Open a post for editing: lock it, and say what the editor needs to keep it
 * safe.
 *
 * @param WP_REST_Request $request The request.
 * @return WP_REST_Response The post's lock, the lock's nonces, any newer
 *                          autosave and the autosave interval.
 */
function cnl_editor_rest_open_post( $request ) {
	$post = get_post( (int) $request['id'] );

	if ( ! cnl_editor_post_has_safety( $post ) ) {
		return rest_ensure_response( array( 'supported' => false ) );
	}

	return rest_ensure_response(
		array(
			'supported'        => true,
			'autosave'         => cnl_editor_get_newer_autosave( $post ),
			'autosaveInterval' => AUTOSAVE_INTERVAL,
			'postLock'         => cnl_editor_lock_post( $post ),
			'postLockUtils'    => array(
				'nonce'       => wp_create_nonce( 'lock-post_' . $post->ID ),
				'unlockNonce' => wp_create_nonce( 'update-post_' . $post->ID ),
				'ajaxUrl'     => admin_url( 'admin-ajax.php' ),
			),
		)
	);
}

/**
 * Delete the current user's autosave of a post, when its changes are
 * discarded, so it isn't offered back next time.
 *
 * @param WP_REST_Request $request The request.
 * @return WP_REST_Response Whether there was one to delete.
 */
function cnl_editor_rest_delete_autosave( $request ) {
	$autosave = wp_get_post_autosave( (int) $request['id'], get_current_user_id() );

	return rest_ensure_response(
		array( 'deleted' => $autosave && (bool) wp_delete_post_revision( $autosave->ID ) )
	);
}

/**
 * Come back to the editor after taking over a post from its lock dialog.
 *
 * Core's dialog links Take over to `post.php`, which locks the post and
 * redirects to the post's edit link, core's post editor. Taken over from
 * here, it comes back to where it was taken over instead.
 */
function cnl_editor_return_after_post_lock_takeover() {
	// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- post.php checks the nonce before redirecting.
	if ( empty( $_GET['get-post-lock'] ) ) {
		return;
	}

	$referer = wp_get_referer();
	$query   = array();
	wp_parse_str( (string) wp_parse_url( (string) $referer, PHP_URL_QUERY ), $query );

	if ( ! $referer || CNL_EDITOR_SLUG !== ( $query['page'] ?? '' ) || false === strpos( $referer, admin_url( 'admin.php' ) ) ) {
		return;
	}

	add_filter(
		'get_edit_post_link',
		static function () use ( $referer ) {
			return $referer;
		}
	);
}
