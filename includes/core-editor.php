<?php
/**
 * Falling back to core's editor.
 *
 * The editor doesn't render PHP meta boxes, so a post whose edit screen has
 * them, or whose post type uses the classic editor, is opened in core's
 * editor (`post.php`) instead. See "Falling back to core's editor" in
 * `docs/architecture.md`.
 *
 * @package CreateNotLearnEditor
 */

defined( 'ABSPATH' ) || exit;

const CNL_EDITOR_CORE_EDITOR_REST_FIELD = 'cnl_use_core_editor';

// The query argument on core's editor that says why the editor sent the
// person there, so it can say so when they arrive.
const CNL_EDITOR_CORE_EDITOR_ARG = 'cnl-editor-opened';

/*
 * Core's own boxes. The block editor replaces each with a panel of its own,
 * and they aren't a reason to leave the editor even when core's flag says to
 * show them: Custom Fields shows once someone turns it on in core's editor.
 */
const CNL_EDITOR_CORE_META_BOX_IDS = array(
	'authordiv',
	'categorydiv',
	'commentsdiv',
	'commentstatusdiv',
	'formatdiv',
	'pageparentdiv',
	'postcustom',
	'postexcerpt',
	'postimagediv',
	'revisionsdiv',
	'slugdiv',
	'submitdiv',
	'tagsdiv-post_tag',
	'trackbacksdiv',
);

/**
 * Register the hooks for falling back to core's editor.
 */
function cnl_editor_register_core_editor_hooks() {
	add_action( 'rest_api_init', 'cnl_editor_register_use_core_editor_field' );
	add_action( 'enqueue_block_editor_assets', 'cnl_editor_enqueue_core_editor_notice' );
	add_action( 'admin_notices', 'cnl_editor_print_core_editor_notice' );
}

/**
 * Whether a screen's meta boxes include any other than core's own.
 *
 * @param array $meta_boxes A screen's entry in `$wp_meta_boxes`: boxes by
 *                          context, then priority, then ID. A removed box
 *                          is `false`.
 * @return bool Whether a plugin or theme added a box.
 */
function cnl_editor_has_plugin_meta_boxes( $meta_boxes ) {
	foreach ( (array) $meta_boxes as $priorities ) {
		foreach ( (array) $priorities as $boxes ) {
			foreach ( (array) $boxes as $id => $box ) {
				if ( ! is_array( $box ) || empty( $box['title'] ) ) {
					continue;
				}

				// Core's flag for a box the block editor replaces, which a
				// plugin can set on its own boxes too.
				if ( ! empty( $box['args']['__back_compat_meta_box'] ) ) {
					continue;
				}

				$box_id = isset( $box['id'] ) ? $box['id'] : $id;
				if ( in_array( $box_id, CNL_EDITOR_CORE_META_BOX_IDS, true ) ) {
					continue;
				}

				return true;
			}
		}
	}

	return false;
}

/**
 * Decide whether a post opens in core's editor rather than this one.
 *
 * @param bool      $uses_block_editor Whether its post type uses the block
 *                                     editor.
 * @param bool      $has_meta_boxes    Whether its edit screen has meta boxes
 *                                     from a plugin or theme.
 * @param bool|null $override          The post's own answer, from the
 *                                     `create-not-learn-editor_use_core_editor`
 *                                     filter, or `null` to follow the post type.
 * @return bool Whether it opens in core's editor.
 */
function cnl_editor_should_use_core_editor( $uses_block_editor, $has_meta_boxes, $override = null ) {
	// The editor is a block editor: nothing else can edit a classic post.
	if ( ! $uses_block_editor ) {
		return true;
	}

	if ( is_bool( $override ) ) {
		return $override;
	}

	return (bool) $has_meta_boxes;
}

/**
 * Whether a post type uses the block editor.
 *
 * @param string $post_type Post type name.
 * @return bool Whether it does.
 */
function cnl_editor_post_type_uses_block_editor( $post_type ) {
	return function_exists( 'use_block_editor_for_post_type' ) &&
		use_block_editor_for_post_type( $post_type );
}

/**
 * Whether a post type's edit screen has meta boxes from a plugin or theme.
 *
 * Builds the screen core's editor would, in a sandbox: core's own boxes,
 * then `add_meta_boxes`, `add_meta_boxes_{$post_type}` and `do_meta_boxes`
 * for a post of the type that isn't saved, and restores everything after.
 * The answer is kept for the rest of the request.
 *
 * Plugins that only add their boxes once core's edit screen loads, on
 * `load-post.php` or `current_screen`, aren't seen. They can say so through
 * the `create-not-learn-editor_use_core_editor` filter.
 *
 * @param string $post_type Post type name.
 * @return bool Whether it has any.
 */
function cnl_editor_post_type_has_meta_boxes( $post_type ) {
	if ( ! isset( $GLOBALS['cnl_editor_meta_box_cache'] ) ) {
		$GLOBALS['cnl_editor_meta_box_cache'] = array();
	}

	$cache = &$GLOBALS['cnl_editor_meta_box_cache'];
	if ( isset( $cache[ $post_type ] ) ) {
		return $cache[ $post_type ];
	}

	$cache[ $post_type ] = cnl_editor_detect_post_type_meta_boxes( $post_type );

	return $cache[ $post_type ];
}

/**
 * Forget the meta boxes found this request, for tests.
 */
function cnl_editor_reset_meta_box_cache() {
	$GLOBALS['cnl_editor_meta_box_cache'] = array();
}

/**
 * Build a post type's edit screen and look at its meta boxes.
 *
 * @param string $post_type Post type name.
 * @return bool Whether a plugin or theme added any.
 */
function cnl_editor_detect_post_type_meta_boxes( $post_type ) {
	if ( ! post_type_exists( $post_type ) ) {
		return false;
	}

	require_once ABSPATH . 'wp-admin/includes/template.php';
	require_once ABSPATH . 'wp-admin/includes/theme.php';
	require_once ABSPATH . 'wp-admin/includes/meta-boxes.php';
	require_once ABSPATH . 'wp-admin/includes/post.php';
	require_once ABSPATH . 'wp-admin/includes/screen.php';
	require_once ABSPATH . 'wp-admin/includes/class-wp-screen.php';

	$names = array( 'wp_meta_boxes', 'current_screen', 'post', 'typenow', 'pagenow', 'hook_suffix' );
	$saved = array();
	foreach ( $names as $name ) {
		if ( array_key_exists( $name, $GLOBALS ) ) {
			$saved[ $name ] = $GLOBALS[ $name ];
		}
	}

	$screen = WP_Screen::get( $post_type );
	$screen->is_block_editor( cnl_editor_post_type_uses_block_editor( $post_type ) );

	// A post of the type that is never saved, as `post-new.php` starts with.
	$post = new WP_Post(
		(object) array(
			'ID'             => 0,
			'post_author'    => get_current_user_id(),
			'post_type'      => $post_type,
			'post_status'    => 'auto-draft',
			'post_title'     => '',
			'post_content'   => '',
			'comment_status' => get_default_comment_status( $post_type ),
			'ping_status'    => get_default_comment_status( $post_type, 'pingback' ),
			'comment_count'  => 0,
			'filter'         => 'raw',
		)
	);

	// phpcs:disable WordPress.WP.GlobalVariablesOverride.Prohibited -- Restored below.
	$GLOBALS['wp_meta_boxes']  = array();
	$GLOBALS['current_screen'] = $screen;
	$GLOBALS['post']           = $post;
	$GLOBALS['typenow']        = $post_type;
	// Some plugins only add their boxes on core's edit screens.
	$GLOBALS['pagenow']     = 'post-new.php';
	$GLOBALS['hook_suffix'] = 'post-new.php';

	$has_meta_boxes = false;

	// Nor should anything a box's hooks enqueue, or print in the footer.
	$queues       = array( wp_scripts()->queue, wp_styles()->queue );
	$footer_hooks = array();
	foreach ( array( 'admin_footer', 'admin_print_footer_scripts' ) as $hook ) {
		$footer_hooks[ $hook ] = isset( $GLOBALS['wp_filter'][ $hook ] ) ? clone $GLOBALS['wp_filter'][ $hook ] : null;
	}

	// Nothing a box's hooks print should reach the page.
	$ob_level = ob_get_level();
	ob_start();
	try {
		register_and_do_post_meta_boxes( $post );

		/** This filter is documented in wp-admin/includes/post.php */
		$meta_boxes = apply_filters( 'filter_block_editor_meta_boxes', $GLOBALS['wp_meta_boxes'] );

		$has_meta_boxes = cnl_editor_has_plugin_meta_boxes(
			isset( $meta_boxes[ $screen->id ] ) ? $meta_boxes[ $screen->id ] : array()
		);
	} catch ( Throwable $error ) {
		// A plugin's box that fails here is still a box.
		$has_meta_boxes = true;
	} finally {
		while ( ob_get_level() > $ob_level ) {
			ob_end_clean();
		}

		foreach ( $names as $name ) {
			if ( array_key_exists( $name, $saved ) ) {
				$GLOBALS[ $name ] = $saved[ $name ];
			} else {
				unset( $GLOBALS[ $name ] );
			}
		}

		wp_scripts()->queue = $queues[0];
		wp_styles()->queue  = $queues[1];
		foreach ( $footer_hooks as $hook => $callbacks ) {
			if ( $callbacks ) {
				$GLOBALS['wp_filter'][ $hook ] = $callbacks;
			} else {
				unset( $GLOBALS['wp_filter'][ $hook ] );
			}
		}
	}
	// phpcs:enable WordPress.WP.GlobalVariablesOverride.Prohibited

	return $has_meta_boxes;
}

/**
 * A post's own answer to whether it opens in core's editor.
 *
 * @param WP_Post $post Post.
 * @return bool|null `true` or `false`, or `null` to follow its post type.
 */
function cnl_editor_get_core_editor_override( $post ) {
	/**
	 * Filters whether a post opens in core's editor rather than this one.
	 *
	 * The editor opens core's editor by itself for a post type whose edit
	 * screen has meta boxes from a plugin or theme, or that uses the classic
	 * editor. Return `true` to open this post there too, for a plugin that
	 * adds its boxes to some posts only or when core's edit screen loads, or
	 * `false` to keep it in this editor. A classic editor post type always
	 * opens in core's editor.
	 *
	 * @param bool|null $use_core_editor `null`, to follow the post type.
	 * @param WP_Post   $post            The post.
	 */
	$override = apply_filters( CNL_EDITOR_SLUG . '_use_core_editor', null, $post );

	return is_bool( $override ) ? $override : null;
}

/**
 * Why a post type's posts open in core's editor, if they do.
 *
 * @param string $post_type Post type name.
 * @return string|null `classic` or `meta-boxes`, or `null` when they open in
 *                     this editor.
 */
function cnl_editor_get_post_type_core_editor_reason( $post_type ) {
	if ( in_array( $post_type, CNL_EDITOR_OWN_EDITOR_POST_TYPES, true ) ) {
		return null;
	}

	$block_editor   = cnl_editor_post_type_uses_block_editor( $post_type );
	$has_meta_boxes = cnl_editor_post_type_has_meta_boxes( $post_type );

	/**
	 * Filters whether a post type's posts open in core's editor rather than
	 * this one.
	 *
	 * Defaults to whether its edit screen has meta boxes from a plugin or
	 * theme, or it uses the classic editor. Return `false` for a post type
	 * the editor edits in full in its own way, as the shop does products.
	 *
	 * @param bool   $use_core_editor Whether its posts open in core's editor.
	 * @param string $post_type       Post type name.
	 * @param bool   $has_meta_boxes  Whether its edit screen has meta boxes.
	 * @param bool   $block_editor    Whether it uses the block editor.
	 */
	$use_core_editor = apply_filters(
		CNL_EDITOR_SLUG . '_post_type_uses_core_editor',
		cnl_editor_should_use_core_editor( $block_editor, $has_meta_boxes ),
		$post_type,
		$has_meta_boxes,
		$block_editor
	);

	if ( ! $use_core_editor ) {
		return null;
	}

	return $block_editor ? 'meta-boxes' : 'classic';
}

/**
 * Whether a post opens in core's editor, for code on the server. The editor
 * decides the same way in `src/core-editor.js`.
 *
 * @param WP_Post|int $post Post or post ID.
 * @return bool Whether it does.
 */
function cnl_editor_post_uses_core_editor( $post ) {
	$post = get_post( $post );
	if ( ! $post || in_array( $post->post_type, CNL_EDITOR_OWN_EDITOR_POST_TYPES, true ) ) {
		return false;
	}

	$reason = cnl_editor_get_post_type_core_editor_reason( $post->post_type );

	// The post's own answer can't keep a classic post here.
	return cnl_editor_should_use_core_editor(
		'classic' !== $reason,
		null !== $reason,
		cnl_editor_get_core_editor_override( $post )
	);
}

/**
 * Put each post's own answer on its REST record, for the editor to read with
 * the post it opens. Only the filter's answer: plugins often add their boxes
 * in wp-admin only, so the post type's answer comes with the editor's
 * settings, built in wp-admin, rather than from a REST request.
 */
function cnl_editor_register_use_core_editor_field() {
	foreach ( cnl_editor_get_content_post_types() as $post_type ) {
		register_rest_field(
			$post_type->name,
			CNL_EDITOR_CORE_EDITOR_REST_FIELD,
			array(
				'get_callback' => static function ( $post ) {
					$post = get_post( $post['id'] );

					return $post ? cnl_editor_get_core_editor_override( $post ) : null;
				},
				'schema'       => array(
					'type'        => array( 'boolean', 'null' ),
					'description' => __( 'Whether the post opens in core\'s editor rather than Create Not Learn Editor, or null to follow its post type.', 'create-not-learn-editor' ),
					'context'     => array( 'edit' ),
					'readonly'    => true,
				),
			)
		);
	}
}

/**
 * The line core's editor shows on arrival from this one, if it came from it.
 *
 * @return string The line, or an empty string.
 */
function cnl_editor_get_core_editor_notice() {
	// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Only picks which line to show.
	$reason = isset( $_GET[ CNL_EDITOR_CORE_EDITOR_ARG ] ) ? sanitize_key( wp_unslash( $_GET[ CNL_EDITOR_CORE_EDITOR_ARG ] ) ) : '';
	if ( ! $reason ) {
		return '';
	}

	$screen    = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
	$post_type = $screen && $screen->post_type ? get_post_type_object( $screen->post_type ) : null;
	$singular  = $post_type ? strtolower( $post_type->labels->singular_name ) : __( 'post', 'create-not-learn-editor' );

	if ( 'classic' === $reason ) {
		/* translators: %s: post type singular label, like "page". */
		return sprintf( __( 'This %s can only be changed in the full editor, so it opens here.', 'create-not-learn-editor' ), $singular );
	}

	/* translators: %s: post type singular label, like "page". */
	return sprintf( __( 'This %s has extra settings from your plugins, so it opens in the full editor.', 'create-not-learn-editor' ), $singular );
}

/**
 * Say why core's block editor opened, as one of its own notices.
 */
function cnl_editor_enqueue_core_editor_notice() {
	$notice = cnl_editor_get_core_editor_notice();
	if ( ! $notice ) {
		return;
	}

	wp_add_inline_script(
		'wp-notices',
		sprintf(
			'window.addEventListener( "DOMContentLoaded", function () { wp.data.dispatch( "core/notices" ).createInfoNotice( %s, { id: "cnl-editor-core-editor", isDismissible: true } ); } );',
			wp_json_encode( $notice )
		)
	);
}

/**
 * Say why the classic editor opened.
 */
function cnl_editor_print_core_editor_notice() {
	$screen = get_current_screen();
	if ( ! $screen || 'post' !== $screen->base || $screen->is_block_editor() ) {
		return;
	}

	$notice = cnl_editor_get_core_editor_notice();
	if ( $notice ) {
		printf( '<div class="notice notice-info is-dismissible"><p>%s</p></div>', esc_html( $notice ) );
	}
}
