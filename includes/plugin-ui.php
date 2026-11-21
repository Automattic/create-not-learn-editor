<?php
/**
 * What the Plugins menu needs from the server: a post's classic meta boxes,
 * which only the full editor (`post.php`) can show. See
 * `src/plugin-ui/README.md`.
 *
 * @package CreateNotLearnEditor
 */

defined( 'ABSPATH' ) || exit;

/**
 * Register the Plugins menu's hooks.
 */
function cnl_editor_register_plugin_ui_hooks() {
	add_action( 'rest_api_init', 'cnl_editor_register_plugin_ui_routes' );
}

/**
 * Register `GET /create-not-learn-editor/v1/meta-boxes/<id>`.
 */
function cnl_editor_register_plugin_ui_routes() {
	register_rest_route(
		CNL_EDITOR_REST_NAMESPACE,
		'/meta-boxes/(?P<id>\d+)',
		array(
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => 'cnl_editor_rest_get_meta_boxes',
			'permission_callback' => static function ( $request ) {
				return current_user_can( 'edit_post', (int) $request['id'] );
			},
		)
	);
}

/**
 * A post's meta boxes, and where to edit them.
 *
 * @param WP_REST_Request $request The request.
 * @return WP_REST_Response|WP_Error The boxes, or an error.
 */
function cnl_editor_rest_get_meta_boxes( $request ) {
	$post = get_post( (int) $request['id'] );

	if ( ! $post ) {
		return new WP_Error( 'rest_post_invalid_id', __( 'Invalid post ID.' ), array( 'status' => 404 ) );
	}

	return rest_ensure_response(
		array(
			'boxes' => cnl_editor_get_meta_boxes( $post ),
			'url'   => get_edit_post_link( $post->ID, 'raw' ),
		)
	);
}

/**
 * The meta boxes plugins add to a post, found the way `post.php` finds them:
 * by firing `add_meta_boxes` for it. Core's own boxes are added elsewhere,
 * and boxes a plugin marks as replaced in the block editor are left out, as
 * the block editor leaves them out.
 *
 * Plugins expect `add_meta_boxes` on an admin screen, so a callback that
 * fails here is skipped rather than failing the request.
 *
 * @param WP_Post $post The post.
 * @return array[] Each box's `id` and `title`.
 */
function cnl_editor_get_meta_boxes( $post ) {
	global $wp_meta_boxes;

	require_once ABSPATH . 'wp-admin/includes/template.php';
	require_once ABSPATH . 'wp-admin/includes/class-wp-screen.php';
	require_once ABSPATH . 'wp-admin/includes/screen.php';

	$saved         = $wp_meta_boxes;
	$wp_meta_boxes = array();

	try {
		do_action( 'add_meta_boxes', $post->post_type, $post );
		do_action( "add_meta_boxes_{$post->post_type}", $post );
	} catch ( Throwable $error ) { // phpcs:ignore Generic.CodeAnalysis.EmptyStatement.DetectedCatch
		// A plugin that can't add its boxes here has none to report.
	}

	$boxes = array();

	foreach ( (array) ( $wp_meta_boxes[ $post->post_type ] ?? array() ) as $priorities ) {
		foreach ( (array) $priorities as $by_id ) {
			foreach ( (array) $by_id as $id => $box ) {
				if ( ! is_array( $box ) || ! empty( $box['args']['__back_compat_meta_box'] ) ) {
					continue;
				}

				$boxes[ $id ] = array(
					'id'    => $id,
					'title' => wp_strip_all_tags( (string) $box['title'] ),
				);
			}
		}
	}

	$wp_meta_boxes = $saved; // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited

	return array_values( $boxes );
}
