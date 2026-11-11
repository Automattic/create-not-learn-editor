<?php
/**
 * Sections: whether a post is built from sections, and so edited as a page
 * is, with Add section, Edit design and Compose, or block by block with core's
 * own tools.
 *
 * One answer per post, read by every part of the editor that offers section
 * editing, so none of them decides by post type or by plugin:
 *
 * - A post type is built from sections when it supports
 *   `create-not-learn-editor-sections`. Pages do. Add the support to a post
 *   type built like pages:
 *
 *       add_post_type_support( 'landing_page', 'create-not-learn-editor-sections' );
 *
 * - The `create-not-learn-editor_has_sections` filter changes the answer for
 *   one post, for a post unlike the rest of its type, such as a page that is a
 *   single app block.
 *
 * Layouts (templates) and template parts are posts of their own types,
 * `wp_template` and `wp_template_part`, so they answer the same way. They
 * don't support sections by default, and either support or the filter turns
 * them on.
 *
 * The answer is on each REST record as `cnl_has_sections`.
 *
 * See `docs/architecture.md`.
 *
 * @package CreateNotLearnEditor
 */

defined( 'ABSPATH' ) || exit;

/**
 * The post type feature that makes a post type built from sections.
 */
const CNL_EDITOR_SECTIONS_FEATURE = CNL_EDITOR_SLUG . '-sections';

/**
 * The REST field with each post's answer.
 */
const CNL_EDITOR_SECTIONS_REST_FIELD = 'cnl_has_sections';

/**
 * Register the sections hooks.
 */
function cnl_editor_register_sections_hooks() {
	add_action( 'init', 'cnl_editor_add_page_sections_support', 20 );
	add_action( 'rest_api_init', 'cnl_editor_register_has_sections_field' );
}

/**
 * Pages are built from sections.
 */
function cnl_editor_add_page_sections_support() {
	add_post_type_support( 'page', CNL_EDITOR_SECTIONS_FEATURE );
}

/**
 * Check whether a post, layout or template part is built from sections.
 *
 * A layout or template part from the theme's files, not yet changed on the
 * site, has no post of its own, so it is given as its `WP_Block_Template`.
 *
 * @param WP_Post|WP_Block_Template|int $post Post, layout or template part,
 *                                            or post ID.
 * @return bool Whether it is edited as sections.
 */
function cnl_editor_post_has_sections( $post ) {
	if ( ! $post instanceof WP_Block_Template ) {
		$post = get_post( $post );
	}

	if ( $post instanceof WP_Block_Template ) {
		$post_type = $post->type;
	} elseif ( $post instanceof WP_Post ) {
		$post_type = $post->post_type;
	} else {
		return false;
	}

	/**
	 * Filters whether a post is built from sections.
	 *
	 * Defaults to whether its post type supports
	 * `create-not-learn-editor-sections`, which pages do and layouts and
	 * template parts don't.
	 *
	 * @param bool                      $has_sections Whether it is edited as sections.
	 * @param WP_Post|WP_Block_Template $post         The post, or the layout or
	 *                                                template part from the
	 *                                                theme's files.
	 */
	return (bool) apply_filters(
		CNL_EDITOR_SLUG . '_has_sections',
		post_type_supports( $post_type, CNL_EDITOR_SECTIONS_FEATURE ),
		$post
	);
}

/**
 * Put each post's answer on its REST record, so the editor reads it with the
 * post it edits.
 */
function cnl_editor_register_has_sections_field() {
	foreach ( get_post_types( array( 'show_in_rest' => true ) ) as $post_type ) {
		$is_template = in_array( $post_type, array( 'wp_template', 'wp_template_part' ), true );

		register_rest_field(
			$post_type,
			CNL_EDITOR_SECTIONS_REST_FIELD,
			array(
				'get_callback' => static function ( $post ) use ( $is_template, $post_type ) {
					// A layout's REST ID is `theme//slug`, and it may only be
					// in the theme's files.
					return cnl_editor_post_has_sections(
						$is_template ? get_block_template( $post['id'], $post_type ) : $post['id']
					);
				},
				'schema'       => array(
					'type'        => 'boolean',
					'description' => __( 'Whether the post is built from sections in Create Not Learn Editor.', 'create-not-learn-editor' ),
					'context'     => array( 'view', 'edit' ),
					'readonly'    => true,
				),
			)
		);
	}
}
