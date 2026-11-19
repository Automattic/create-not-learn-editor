<?php
/**
 * Site history: a small log of what each Publish site saved together.
 *
 * Core keeps a revision of every template, template part, global styles
 * record and menu it saves, but nothing says which revisions were saved
 * together, and site settings have no revisions at all. So each Publish site
 * adds one entry here: when, who, and for each change either the revision it
 * made or, for site settings, the values it saved. Restore reads those back.
 * Pages and posts are left out; they keep core's own revisions.
 *
 * @package CreateNotLearnEditor
 */

defined( 'ABSPATH' ) || exit;

const CNL_EDITOR_SITE_HISTORY_OPTION = 'create-not-learn-editor_site_history';

// Entries kept, newest first. Revisions are core's to prune; this is only
// the index over them.
const CNL_EDITOR_SITE_HISTORY_LIMIT = 50;

// Details kept for each change; the rest are counted as `more`.
const CNL_EDITOR_SITE_HISTORY_DETAIL_LIMIT = 60;

/**
 * Register site history hooks.
 */
function cnl_editor_register_site_history_hooks() {
	add_action( 'rest_api_init', 'cnl_editor_register_site_history_routes' );
}

/**
 * Register the site history routes.
 */
function cnl_editor_register_site_history_routes() {
	$can_edit = static function () {
		return current_user_can( 'edit_theme_options' );
	};

	register_rest_route(
		CNL_EDITOR_REST_NAMESPACE,
		'/site-history',
		array(
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => static function () {
					return rest_ensure_response( cnl_editor_get_site_history() );
				},
				'permission_callback' => $can_edit,
			),
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => 'cnl_editor_rest_record_site_history',
				'permission_callback' => $can_edit,
				'args'                => array(
					'changes' => array(
						'type'     => 'array',
						'required' => true,
					),
				),
			),
		)
	);
}

/**
 * Record a Publish site, from the editor once its save has finished.
 *
 * @param WP_REST_Request $request Request.
 * @return WP_REST_Response|WP_Error The entry, or an error when nothing in it
 *                                   belongs in the history.
 */
function cnl_editor_rest_record_site_history( $request ) {
	$entry = cnl_editor_record_site_history( (array) $request['changes'] );

	if ( ! $entry ) {
		return new WP_Error(
			'cnl_editor_no_history_changes',
			__( 'None of those changes belong in the site history.', 'create-not-learn-editor' ),
			array( 'status' => 400 )
		);
	}

	$response = rest_ensure_response( cnl_editor_prepare_site_history_entry( $entry ) );
	$response->set_status( 201 );

	return $response;
}

/**
 * The post behind a change, if it is one the site history keeps.
 *
 * @param string     $kind Entity kind, as the editor names it.
 * @param string     $name Entity name.
 * @param string|int $key  Entity key: a template's ID is `theme//slug`.
 * @return int Post ID, or 0 when it isn't there or isn't kept.
 */
function cnl_editor_get_site_history_post_id( $kind, $name, $key ) {
	if ( 'root' === $kind && 'globalStyles' === $name ) {
		$post_type = 'wp_global_styles';
	} elseif ( 'postType' === $kind && in_array( $name, array( 'wp_template', 'wp_template_part', 'wp_navigation' ), true ) ) {
		$post_type = $name;
	} else {
		return 0;
	}

	if ( in_array( $post_type, array( 'wp_template', 'wp_template_part' ), true ) && ! is_numeric( $key ) ) {
		$template = get_block_template( (string) $key, $post_type );

		return $template && ! empty( $template->wp_id ) ? (int) $template->wp_id : 0;
	}

	$post_id = (int) $key;

	return $post_id && get_post_type( $post_id ) === $post_type ? $post_id : 0;
}

/**
 * Tidy the changes the editor reports into what the log keeps. Anything the
 * history doesn't cover is dropped, so a page can't end up in it.
 *
 * @param array $changes Each `kind`, `name`, `key`, `label`, and for site
 *                       settings `values`, a map of setting to value.
 * @return array[] The changes to keep.
 */
function cnl_editor_prepare_site_history_changes( array $changes ) {
	$kept = array();

	foreach ( $changes as $change ) {
		if ( ! is_array( $change ) ) {
			continue;
		}

		$kind  = isset( $change['kind'] ) ? sanitize_text_field( $change['kind'] ) : '';
		$name  = isset( $change['name'] ) ? sanitize_text_field( $change['name'] ) : '';
		$label = isset( $change['label'] ) ? sanitize_text_field( $change['label'] ) : '';
		$item  = array_merge(
			array(
				'kind'  => $kind,
				'name'  => $name,
				'label' => $label,
			),
			cnl_editor_prepare_site_history_description( $change )
		);

		if ( 'root' === $kind && 'site' === $name ) {
			$values = array();

			foreach ( isset( $change['values'] ) && is_array( $change['values'] ) ? $change['values'] : array() as $setting => $value ) {
				if ( is_scalar( $value ) || null === $value ) {
					$values[ sanitize_key( $setting ) ] = is_string( $value ) ? sanitize_text_field( $value ) : $value;
				}
			}

			if ( ! $values ) {
				continue;
			}

			$item['values'] = $values;
			$kept[]         = $item;
			continue;
		}

		$key     = isset( $change['key'] ) && is_scalar( $change['key'] ) ? (string) $change['key'] : '';
		$post_id = cnl_editor_get_site_history_post_id( $kind, $name, $key );

		if ( ! $post_id ) {
			continue;
		}

		$item['key'] = $key;
		// The newest revision is the one this save just made, or the one it
		// matched when nothing differed.
		$revisions = wp_get_post_revisions(
			$post_id,
			array(
				'posts_per_page' => 1,
				'fields'         => 'ids',
			)
		);

		if ( $revisions ) {
			$item['revision'] = (int) reset( $revisions );
		}

		$kept[] = $item;
	}

	return $kept;
}

/**
 * Tidy what the editor says a change changed: a summary, and each detail
 * from what to what. The editor works these out before saving, while it
 * still has the old values; see `src/top-bar/site-history-diff.js`.
 *
 * @param array $change A change, with `summary`, `details` and `more`.
 * @return array The kept parts, empty when there are none.
 */
function cnl_editor_prepare_site_history_description( array $change ) {
	if ( empty( $change['details'] ) || ! is_array( $change['details'] ) ) {
		return array();
	}

	$details = array();

	foreach ( array_slice( $change['details'], 0, CNL_EDITOR_SITE_HISTORY_DETAIL_LIMIT ) as $detail ) {
		if ( ! is_array( $detail ) || empty( $detail['label'] ) ) {
			continue;
		}

		$kept = array(
			'label' => sanitize_text_field( $detail['label'] ),
			'kind'  => isset( $detail['kind'] ) && in_array( $detail['kind'], array( 'added', 'removed' ), true ) ? $detail['kind'] : 'changed',
		);

		foreach ( array( 'from', 'to' ) as $side ) {
			$value = isset( $detail[ $side ] ) && is_array( $detail[ $side ] ) ? cnl_editor_prepare_site_history_value( $detail[ $side ] ) : null;

			if ( $value ) {
				$kept[ $side ] = $value;
			}
		}

		$details[] = $kept;
	}

	if ( ! $details ) {
		return array();
	}

	$description = array(
		'summary' => isset( $change['summary'] ) ? sanitize_text_field( $change['summary'] ) : '',
		'details' => $details,
	);
	$more        = ( isset( $change['more'] ) ? absint( $change['more'] ) : 0 ) + max( 0, count( $change['details'] ) - CNL_EDITOR_SITE_HISTORY_DETAIL_LIMIT );

	if ( $more ) {
		$description['more'] = $more;
	}

	return $description;
}

/**
 * One side of a detail, as text with a colour or image to show beside it.
 * Only a colour CSS can read plainly, and only a web address, are kept.
 *
 * @param array $value `text`, and maybe `color` or `image`.
 * @return array|null The value, or null without text.
 */
function cnl_editor_prepare_site_history_value( array $value ) {
	if ( ! isset( $value['text'] ) || ! is_scalar( $value['text'] ) ) {
		return null;
	}

	$kept = array( 'text' => sanitize_text_field( (string) $value['text'] ) );

	if ( isset( $value['color'] ) && is_string( $value['color'] ) && preg_match( '/^(#[0-9a-f]{3,8}|(rgb|hsl)a?\([0-9a-z.,%\s\/-]*\)|[a-z]+)$/i', trim( $value['color'] ) ) ) {
		$kept['color'] = trim( $value['color'] );
	}

	if ( isset( $value['image'] ) && is_string( $value['image'] ) ) {
		$url = esc_url_raw( $value['image'], array( 'http', 'https' ) );

		if ( $url ) {
			$kept['image'] = $url;
		}
	}

	return $kept;
}

/**
 * Add an entry to the log.
 *
 * @param array $changes What was published, as `cnl_editor_prepare_site_history_changes()`
 *                       takes it.
 * @param int   $user_id Who published. Defaults to the current user.
 * @return array|null The entry, or null when nothing in it belongs here.
 */
function cnl_editor_record_site_history( array $changes, $user_id = 0 ) {
	$changes = cnl_editor_prepare_site_history_changes( $changes );

	if ( ! $changes ) {
		return null;
	}

	$entry   = array(
		'id'      => wp_generate_uuid4(),
		'time'    => time(),
		'user_id' => (int) ( $user_id ? $user_id : get_current_user_id() ),
		'changes' => $changes,
	);
	$history = get_option( CNL_EDITOR_SITE_HISTORY_OPTION, array() );
	$history = is_array( $history ) ? $history : array();

	array_unshift( $history, $entry );

	// Not autoloaded: only the history panel reads it.
	update_option( CNL_EDITOR_SITE_HISTORY_OPTION, array_slice( $history, 0, CNL_EDITOR_SITE_HISTORY_LIMIT ), false );

	return $entry;
}

/**
 * An entry as the editor reads it, with the person's name.
 *
 * @param array $entry A logged entry.
 * @return array The entry.
 */
function cnl_editor_prepare_site_history_entry( array $entry ) {
	$user = get_userdata( $entry['user_id'] );

	return array(
		'id'      => $entry['id'],
		'time'    => $entry['time'],
		'user'    => array(
			'id'   => $entry['user_id'],
			'name' => $user ? $user->display_name : '',
		),
		'changes' => $entry['changes'],
	);
}

/**
 * The log, newest first.
 *
 * @return array[] Entries, each with `id`, `time`, `user` and `changes`.
 */
function cnl_editor_get_site_history() {
	$history = get_option( CNL_EDITOR_SITE_HISTORY_OPTION, array() );

	return array_map( 'cnl_editor_prepare_site_history_entry', is_array( $history ) ? $history : array() );
}
