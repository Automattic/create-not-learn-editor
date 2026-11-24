<?php
/**
 * Unsaved changes in the canvas preview.
 *
 * Browse shows the real site in an iframe. To show it as it would be once
 * saved, the editor sends its unsaved changes here, and the preview's
 * requests name the editor session they belong to with
 * `cnl-editor-changes`. On those requests, for the user who sent them, the
 * changes are put in place of what is saved: posts' titles and content,
 * layouts and site parts, synced sections and menus, the site's look, and
 * its settings. Nothing is saved, and nothing is cached.
 *
 * @package CreateNotLearnEditor
 */

defined( 'ABSPATH' ) || exit;

/**
 * The user option the changes are kept in, by session.
 */
const CNL_EDITOR_PREVIEW_CHANGES_OPTION = 'cnl_editor_preview_changes';

/**
 * The query arg that names the editor session on a preview request.
 */
const CNL_EDITOR_PREVIEW_CHANGES_PARAM = 'cnl-editor-changes';

/**
 * How long a session's changes are kept after it last sent them. An open
 * editor sends them again whenever the preview is shown.
 */
const CNL_EDITOR_PREVIEW_CHANGES_LIFETIME = HOUR_IN_SECONDS;

/**
 * How many sessions' changes are kept for one user, the latest sent. Each
 * editor tab is a session, and the changes are read with the user on every
 * request they make.
 */
const CNL_EDITOR_PREVIEW_CHANGES_MAX_SESSIONS = 5;

/**
 * The most one session's changes may take up, as JSON. More than that is
 * refused, and the editor asks for the changes to be saved first instead.
 */
const CNL_EDITOR_PREVIEW_CHANGES_MAX_BYTES = 2 * MB_IN_BYTES;

/**
 * The site settings the preview can show unsaved.
 */
const CNL_EDITOR_PREVIEW_SITE_SETTINGS = array(
	'title'          => 'blogname',
	'description'    => 'blogdescription',
	'site_logo'      => 'site_logo',
	'site_icon'      => 'site_icon',
	'show_on_front'  => 'show_on_front',
	'page_on_front'  => 'page_on_front',
	'page_for_posts' => 'page_for_posts',
	'posts_per_page' => 'posts_per_page',
);

/**
 * Register the hooks for unsaved changes in the preview.
 */
function cnl_editor_register_preview_changes_hooks() {
	add_action( 'rest_api_init', 'cnl_editor_register_preview_changes_route' );
	// Once the request is known not to be for the REST API, and before the
	// page is queried.
	add_action( 'parse_request', 'cnl_editor_apply_preview_changes', 0 );
	// Unsaved work isn't left in the database once it can't be shown: it is
	// tidied when the editor opens, and gone when its user logs out.
	add_action( CNL_EDITOR_SLUG . '_init', 'cnl_editor_forget_expired_preview_changes' );
	add_action( 'wp_logout', 'cnl_editor_forget_preview_changes' );
}

/**
 * Who may send changes, and see them: whoever can open the editor.
 *
 * @return bool Whether the current user can.
 */
function cnl_editor_can_preview_changes() {
	return current_user_can( 'edit_theme_options' );
}

/**
 * Register the route the editor sends its unsaved changes to.
 */
function cnl_editor_register_preview_changes_route() {
	$text = array( 'type' => 'string' );

	register_rest_route(
		CNL_EDITOR_REST_NAMESPACE,
		'/preview-changes',
		array(
			'methods'             => WP_REST_Server::CREATABLE,
			'callback'            => 'cnl_editor_rest_keep_preview_changes',
			'permission_callback' => 'cnl_editor_can_preview_changes',
			'args'                => array(
				'session'   => array(
					'type'     => 'string',
					'required' => true,
					'pattern'  => '^[a-zA-Z0-9-]{8,64}$',
				),
				// By post ID: pages, posts, synced sections and menus.
				'posts'     => array(
					'type'                 => 'object',
					'default'              => array(),
					'patternProperties'    => array(
						'^[1-9][0-9]*$' => array(
							'type'                 => 'object',
							'properties'           => array(
								'title'    => $text,
								'content'  => $text,
								'template' => $text,
							),
							'additionalProperties' => false,
						),
					),
					'additionalProperties' => false,
				),
				// By template ID, `theme//slug`: layouts and site parts.
				'templates' => array(
					'type'                 => 'object',
					'default'              => array(),
					'additionalProperties' => array(
						'type'                 => 'object',
						'properties'           => array(
							'postType' => array(
								'type'     => 'string',
								'enum'     => array( 'wp_template', 'wp_template_part' ),
								'required' => true,
							),
							'title'    => $text,
							'content'  => $text,
						),
						'additionalProperties' => false,
					),
				),
				'styles'    => array(
					'type'                 => array( 'object', 'null' ),
					'default'              => null,
					'properties'           => array(
						'styles'   => array( 'type' => 'object' ),
						'settings' => array( 'type' => 'object' ),
					),
					'additionalProperties' => false,
				),
				'site'      => array(
					'type'                 => 'object',
					'default'              => array(),
					'properties'           => array(
						'title'          => $text,
						'description'    => $text,
						'site_logo'      => array( 'type' => array( 'integer', 'null' ) ),
						'site_icon'      => array( 'type' => array( 'integer', 'null' ) ),
						'show_on_front'  => array(
							'type' => 'string',
							'enum' => array( 'posts', 'page' ),
						),
						'page_on_front'  => array( 'type' => 'integer' ),
						'page_for_posts' => array( 'type' => 'integer' ),
						'posts_per_page' => array( 'type' => 'integer' ),
					),
					'additionalProperties' => false,
				),
			),
		)
	);
}

/**
 * Block markup from the request, made safe for a user who may not post
 * unfiltered HTML, as saving it would.
 *
 * @param string $value Markup.
 * @return string Markup.
 */
function cnl_editor_preview_changes_markup( $value ) {
	return current_user_can( 'unfiltered_html' ) ? $value : wp_kses_post( $value );
}

/**
 * The changes in a request, cleaned as saving them would clean them.
 *
 * @param array $params The request's params, checked against its schema.
 * @return array `posts`, `templates`, `styles` and `site`, each empty or
 *               null when nothing of that kind changed.
 */
function cnl_editor_clean_preview_changes( $params ) {
	$changes = array(
		'posts'     => array(),
		'templates' => array(),
		'styles'    => null,
		'site'      => array(),
	);

	foreach ( (array) ( $params['posts'] ?? array() ) as $id => $post ) {
		$id = absint( $id );

		// Only what the user could change. Reading it doesn't need more.
		if ( ! $id || ! current_user_can( 'edit_post', $id ) ) {
			continue;
		}

		if ( isset( $post['title'] ) ) {
			$changes['posts'][ $id ]['title'] = sanitize_text_field( $post['title'] );
		}

		if ( isset( $post['content'] ) ) {
			$changes['posts'][ $id ]['content'] = cnl_editor_preview_changes_markup( $post['content'] );
		}

		if ( isset( $post['template'] ) ) {
			$changes['posts'][ $id ]['template'] = sanitize_text_field( $post['template'] );
		}
	}

	foreach ( (array) ( $params['templates'] ?? array() ) as $id => $template ) {
		$kept = array( 'postType' => $template['postType'] );

		if ( isset( $template['title'] ) ) {
			$kept['title'] = sanitize_text_field( $template['title'] );
		}

		if ( isset( $template['content'] ) ) {
			$kept['content'] = cnl_editor_preview_changes_markup( $template['content'] );
		}

		$changes['templates'][ sanitize_text_field( $id ) ] = $kept;
	}

	if ( is_array( $params['styles'] ?? null ) ) {
		$changes['styles'] = array(
			'styles'   => (array) ( $params['styles']['styles'] ?? array() ),
			'settings' => (array) ( $params['styles']['settings'] ?? array() ),
		);
	}

	// The site's settings are only shown to those who could save them.
	$site = current_user_can( 'manage_options' ) ? (array) ( $params['site'] ?? array() ) : array();

	foreach ( array( 'title', 'description' ) as $field ) {
		if ( isset( $site[ $field ] ) ) {
			$changes['site'][ $field ] = sanitize_text_field( $site[ $field ] );
		}
	}

	// An image taken away is sent as null, and kept as 0, no image.
	foreach ( array( 'site_logo', 'site_icon', 'page_on_front', 'page_for_posts' ) as $field ) {
		if ( array_key_exists( $field, $site ) ) {
			$changes['site'][ $field ] = absint( $site[ $field ] );
		}
	}

	if ( isset( $site['posts_per_page'] ) && $site['posts_per_page'] >= 1 ) {
		$changes['site']['posts_per_page'] = min( absint( $site['posts_per_page'] ), CNL_EDITOR_PREVIEW_MAX_POSTS_PER_PAGE );
	}

	if ( isset( $site['show_on_front'] ) ) {
		$changes['site']['show_on_front'] = $site['show_on_front'];
	}

	return $changes;
}

/**
 * Whether there is nothing to show.
 *
 * @param array $changes Changes, as `cnl_editor_clean_preview_changes()`
 *                       gives them.
 * @return bool Whether there are none.
 */
function cnl_editor_preview_changes_are_empty( $changes ) {
	return ! $changes['posts']
		&& ! $changes['templates']
		&& null === $changes['styles']
		&& ! $changes['site'];
}

/**
 * The changes kept for a user, by session, without any that have expired.
 *
 * @param int $user_id User ID.
 * @return array `{ time, changes }` by session.
 */
function cnl_editor_get_kept_preview_changes( $user_id ) {
	$records = get_user_option( CNL_EDITOR_PREVIEW_CHANGES_OPTION, $user_id );

	if ( ! is_array( $records ) ) {
		return array();
	}

	$oldest = time() - CNL_EDITOR_PREVIEW_CHANGES_LIFETIME;

	return array_filter(
		$records,
		static function ( $record ) use ( $oldest ) {
			return is_array( $record ) && ( $record['time'] ?? 0 ) >= $oldest;
		}
	);
}

/**
 * Forget the changes a user's sessions sent too long ago to be shown.
 *
 * @param int $user_id User ID. Defaults to the current user.
 */
function cnl_editor_forget_expired_preview_changes( $user_id = 0 ) {
	$user_id = $user_id ? $user_id : get_current_user_id();
	$saved   = get_user_option( CNL_EDITOR_PREVIEW_CHANGES_OPTION, $user_id );

	if ( false === $saved ) {
		return;
	}

	$records = cnl_editor_get_kept_preview_changes( $user_id );

	if ( ! $records ) {
		delete_user_option( $user_id, CNL_EDITOR_PREVIEW_CHANGES_OPTION );
	} elseif ( ! is_array( $saved ) || count( $records ) < count( $saved ) ) {
		update_user_option( $user_id, CNL_EDITOR_PREVIEW_CHANGES_OPTION, wp_slash( $records ) );
	}
}

/**
 * Forget every change kept for a user.
 *
 * @param int $user_id User ID.
 */
function cnl_editor_forget_preview_changes( $user_id ) {
	delete_user_option( $user_id, CNL_EDITOR_PREVIEW_CHANGES_OPTION );
}

/**
 * Keep a session's unsaved changes for the current user, or forget them
 * when there are none.
 *
 * @param WP_REST_Request $request Request.
 * @return WP_REST_Response|WP_Error Whether any are kept, and whether they
 *                                   changed, or an error when there are too
 *                                   many to keep.
 */
function cnl_editor_rest_keep_preview_changes( $request ) {
	$user_id = get_current_user_id();
	$session = $request['session'];
	$changes = cnl_editor_clean_preview_changes( $request->get_params() );
	$records = cnl_editor_get_kept_preview_changes( $user_id );
	$is_kept = ! cnl_editor_preview_changes_are_empty( $changes );
	$before  = $records[ $session ]['changes'] ?? null;

	if ( $is_kept && strlen( (string) wp_json_encode( $changes ) ) > CNL_EDITOR_PREVIEW_CHANGES_MAX_BYTES ) {
		return new WP_Error(
			'cnl_editor_preview_changes_too_large',
			__( 'There are too many unsaved changes to preview. Save them first.', 'create-not-learn-editor' ),
			array( 'status' => 413 )
		);
	}

	unset( $records[ $session ] );

	if ( $is_kept ) {
		// Last, so it is the latest: the oldest sessions make way.
		$records[ $session ] = array(
			'time'    => time(),
			'changes' => $changes,
		);
		$records             = array_slice( $records, -CNL_EDITOR_PREVIEW_CHANGES_MAX_SESSIONS, null, true );
	}

	if ( $records ) {
		update_user_option( $user_id, CNL_EDITOR_PREVIEW_CHANGES_OPTION, wp_slash( $records ) );
	} else {
		delete_user_option( $user_id, CNL_EDITOR_PREVIEW_CHANGES_OPTION );
	}

	return rest_ensure_response(
		array(
			'kept'    => $is_kept,
			// Whether the preview shows something different now, and so has
			// to load again.
			'changed' => ( $is_kept ? $changes : null ) !== $before,
		)
	);
}

/**
 * The editor session a preview request names.
 *
 * @return string Session, or an empty string.
 */
function cnl_editor_get_preview_changes_session() {
	$session = filter_input( INPUT_GET, CNL_EDITOR_PREVIEW_CHANGES_PARAM, FILTER_SANITIZE_FULL_SPECIAL_CHARS );

	/**
	 * Filters the editor session a preview request names.
	 *
	 * @param string $session The `cnl-editor-changes` query arg, or an empty
	 *                        string.
	 */
	return (string) apply_filters( CNL_EDITOR_SLUG . '_preview_changes_session', is_string( $session ) ? $session : '' );
}

/**
 * The changes to show on this request, or null when it isn't a preview of
 * any: a front-end preview request, naming a session of a user who can open
 * the editor.
 *
 * @param WP $wp The request, parsed.
 * @return array|null Changes, or null.
 */
function cnl_editor_get_request_preview_changes( $wp ) {
	if (
		! empty( $wp->query_vars['rest_route'] ) ||
		! cnl_editor_is_preview_frame_request() ||
		! cnl_editor_can_preview_changes()
	) {
		return null;
	}

	$session = cnl_editor_get_preview_changes_session();

	if ( '' === $session ) {
		return null;
	}

	$records = cnl_editor_get_kept_preview_changes( get_current_user_id() );

	return $records[ $session ]['changes'] ?? null;
}

/**
 * Draw a synced section from its unsaved content, as the core/block block
 * draws the saved one: with its embeds and its overrides, and once only when
 * it holds itself.
 *
 * @param string $content    Unsaved content.
 * @param array  $attributes The block's attributes.
 * @return string HTML.
 */
function cnl_editor_render_preview_pattern( $content, $attributes ) {
	static $seen = array();
	global $wp_embed;

	$ref = $attributes['ref'];

	if ( isset( $seen[ $ref ] ) ) {
		return '';
	}

	$seen[ $ref ] = true;
	$overrides    = $attributes['content'] ?? null;
	$with         = static function ( $context ) use ( $overrides ) {
		if ( null !== $overrides ) {
			$context['pattern/overrides'] = $overrides;
		}

		return $context;
	};

	add_filter( 'render_block_context', $with, 1 );
	$html = do_blocks( $wp_embed->autoembed( $wp_embed->run_shortcode( $content ) ) );
	remove_filter( 'render_block_context', $with, 1 );
	unset( $seen[ $ref ] );

	return $html;
}

/**
 * Put a request's unsaved changes in place, for a preview request.
 *
 * @param WP $wp The request, parsed.
 */
function cnl_editor_apply_preview_changes( $wp ) {
	$changes = cnl_editor_get_request_preview_changes( $wp );

	if ( null === $changes ) {
		return;
	}

	$posts     = $changes['posts'] ?? array();
	$templates = $changes['templates'] ?? array();

	// Never cache a page drawn with someone's unsaved changes, in the
	// browser or in a persistent object cache that outlives the request.
	add_action( 'send_headers', 'nocache_headers' );
	wp_suspend_cache_addition( true );

	// Posts found by queries: the page itself, lists of pages, and the posts
	// layouts and site parts are kept in. Changed as copies, so the saved
	// post objects stay as they were.
	add_filter(
		'posts_results',
		static function ( $results ) use ( $posts, $templates ) {
			foreach ( $results as $index => $post ) {
				if ( ! $post instanceof WP_Post ) {
					continue;
				}

				$kept = $posts[ $post->ID ] ?? array();

				if ( in_array( $post->post_type, array( 'wp_template', 'wp_template_part' ), true ) ) {
					$id   = get_stylesheet() . '//' . $post->post_name;
					$kept = ( $templates[ $id ]['postType'] ?? '' ) === $post->post_type ? $templates[ $id ] : array();
				}

				if ( ! isset( $kept['title'] ) && ! isset( $kept['content'] ) ) {
					continue;
				}

				$post = clone $post;

				if ( isset( $kept['title'] ) ) {
					$post->post_title = $kept['title'];
				}

				if ( isset( $kept['content'] ) ) {
					$post->post_content = $kept['content'];
				}

				$results[ $index ] = $post;
			}

			return $results;
		}
	);

	// A page's layout.
	add_filter(
		'get_post_metadata',
		static function ( $value, $object_id, $meta_key, $single ) use ( $posts ) {
			if ( '_wp_page_template' !== $meta_key || ! isset( $posts[ $object_id ]['template'] ) ) {
				return $value;
			}

			$template = $posts[ $object_id ]['template'];

			return $single ? $template : array( $template );
		},
		10,
		4
	);

	// Layouts and site parts, saved or from the theme.
	$swap = static function ( $template, $id, $type ) use ( $templates ) {
		if ( ! $template || ( $templates[ $id ]['postType'] ?? '' ) !== $type ) {
			return $template;
		}

		$template = clone $template;

		if ( isset( $templates[ $id ]['content'] ) ) {
			$template->content = $templates[ $id ]['content'];
		}

		if ( isset( $templates[ $id ]['title'] ) ) {
			$template->title = $templates[ $id ]['title'];
		}

		return $template;
	};

	add_filter( 'get_block_template', $swap, 10, 3 );
	add_filter( 'get_block_file_template', $swap, 10, 3 );
	add_filter(
		'get_block_templates',
		static function ( $results, $query, $type ) use ( $swap ) {
			foreach ( $results as $index => $template ) {
				$results[ $index ] = $swap( $template, $template->id, $type );
			}

			return $results;
		},
		10,
		3
	);

	// Synced sections and menus, which their blocks read with get_post().
	add_filter(
		'pre_render_block',
		static function ( $pre, $parsed ) use ( $posts ) {
			$ref = $parsed['attrs']['ref'] ?? null;

			if ( 'core/block' !== $parsed['blockName'] || ! $ref || ! isset( $posts[ $ref ]['content'] ) ) {
				return $pre;
			}

			return cnl_editor_render_preview_pattern( $posts[ $ref ]['content'], $parsed['attrs'] );
		},
		10,
		2
	);
	add_filter(
		'render_block_data',
		static function ( $parsed ) use ( $posts ) {
			$ref = $parsed['attrs']['ref'] ?? null;

			if ( 'core/navigation' !== $parsed['blockName'] || ! $ref || ! isset( $posts[ $ref ]['content'] ) ) {
				return $parsed;
			}

			$inner = array_values(
				array_filter(
					parse_blocks( $posts[ $ref ]['content'] ),
					static function ( $block ) {
						return null !== $block['blockName'];
					}
				)
			);

			unset( $parsed['attrs']['ref'] );
			$parsed['innerBlocks']  = $inner;
			$parsed['innerContent'] = array_fill( 0, count( $inner ), null );
			$parsed['innerHTML']    = '';

			return $parsed;
		}
	);

	if ( is_array( $changes['styles'] ?? null ) ) {
		cnl_editor_apply_preview_styles( $changes['styles'] );
	}

	foreach ( (array) ( $changes['site'] ?? array() ) as $field => $value ) {
		if ( ! isset( CNL_EDITOR_PREVIEW_SITE_SETTINGS[ $field ] ) ) {
			continue;
		}

		// Ahead of the canvas's own query args, which say the same thing.
		add_filter(
			'pre_option_' . CNL_EDITOR_PREVIEW_SITE_SETTINGS[ $field ],
			static function () use ( $value ) {
				return $value;
			},
			5
		);
	}
}

/**
 * Show the site's look as edited, in place of the saved one.
 *
 * @param array $styles `styles` and `settings`, as the editor has them.
 */
function cnl_editor_apply_preview_styles( $styles ) {
	add_filter(
		'wp_theme_json_data_user',
		static function ( $saved ) use ( $styles ) {
			$version = $saved->get_data()['version'] ?? WP_Theme_JSON::LATEST_SCHEMA;

			if ( ! current_user_can( 'unfiltered_html' ) ) {
				// What WordPress would take out when saving them.
				$styles['version']                     = $version;
				$styles['isGlobalStylesUserThemeJSON'] = true;
				$styles                                = json_decode(
					wp_unslash( wp_filter_global_styles_post( wp_slash( wp_json_encode( $styles ) ) ) ),
					true
				);
			}

			return new WP_Theme_JSON_Data(
				array(
					'version'  => $version,
					'styles'   => $styles['styles'] ?? array(),
					'settings' => $styles['settings'] ?? array(),
				),
				'custom'
			);
		}
	);

	// Styles read earlier in the request are read again.
	wp_clean_theme_json_cache();

	// WordPress keeps the block styles it compiles in a transient, for every
	// visitor. A preview leaves it as it found it.
	add_filter(
		'pre_set_transient_wp_styles_for_blocks',
		static function ( $compiled ) {
			$found = get_transient( 'wp_styles_for_blocks' );

			return false === $found ? $compiled : $found;
		}
	);
}
