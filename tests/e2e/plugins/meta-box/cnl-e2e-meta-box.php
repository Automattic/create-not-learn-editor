<?php
/**
 * Plugin Name: CNL e2e meta box
 * Description: Adds a meta box to posts, for the editor's end-to-end tests of falling back to core's editor. Mapped into the tests site only; see `.wp-env.json`.
 * Version: 1.0.0
 *
 * @package CreateNotLearnEditor
 */

defined( 'ABSPATH' ) || exit;

add_action(
	'add_meta_boxes_post',
	static function () {
		add_meta_box(
			'cnl-e2e-event-details',
			'Event details',
			static function () {
				echo '<p>Event details from a plugin.</p>';
			},
			'post',
			'normal'
		);
	}
);

// A page whose title says so opens in core's editor, as a plugin adding its
// boxes to some pages only would ask.
add_filter(
	'create-not-learn-editor_use_core_editor',
	static function ( $use_core_editor, $post ) {
		return 0 === strpos( $post->post_title, 'Core editor page' ) ? true : $use_core_editor;
	},
	10,
	2
);
