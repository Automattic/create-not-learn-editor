<?php
/**
 * Kinds of post: the starting points a writer picks from when they write a
 * post, like a note, a photo or a quote.
 *
 * Each kind is a block pattern in the `cnl-post-kinds` category, so a theme
 * can offer kinds of its own by registering patterns in it. They are kept out
 * of the inserter, as they are ways to start a post rather than something to
 * add to one. The editor gives the plugin's own kinds their icons and post
 * formats (`src/post-kinds.js`); a theme's are standard posts.
 *
 * @package CreateNotLearnEditor
 */

defined( 'ABSPATH' ) || exit;

/**
 * Register post kind hooks.
 */
function cnl_editor_register_post_kind_hooks() {
	add_action( 'init', 'cnl_editor_register_post_kinds', 20 );
}

/**
 * An empty paragraph that asks for what goes in it.
 *
 * @param string $placeholder What the paragraph asks for.
 * @return string Block markup.
 */
function cnl_editor_post_kind_paragraph( $placeholder ) {
	return sprintf(
		"<!-- wp:paragraph %s -->\n<p></p>\n<!-- /wp:paragraph -->",
		wp_json_encode( array( 'placeholder' => $placeholder ), JSON_UNESCAPED_UNICODE )
	);
}

/**
 * The plugin's kinds of post, in the order they are offered.
 *
 * @return array[] Pattern properties, keyed by kind.
 */
function cnl_editor_get_post_kinds() {
	$image   = "<!-- wp:image -->\n<figure class=\"wp-block-image\"><img alt=\"\"/></figure>\n<!-- /wp:image -->";
	$gallery = "<!-- wp:gallery {\"linkTo\":\"none\"} -->\n<figure class=\"wp-block-gallery has-nested-images columns-default is-cropped\"></figure>\n<!-- /wp:gallery -->";

	return array(
		'note'    => array(
			'title'       => __( 'Note', 'create-not-learn-editor' ),
			'description' => __( 'A quick thought', 'create-not-learn-editor' ),
			'content'     => cnl_editor_post_kind_paragraph( __( 'What’s on your mind?', 'create-not-learn-editor' ) ),
		),
		'link'    => array(
			'title'       => __( 'Link', 'create-not-learn-editor' ),
			'description' => __( 'Something you found', 'create-not-learn-editor' ),
			'content'     => cnl_editor_post_kind_paragraph( __( 'Paste a link, then say why it’s worth a look', 'create-not-learn-editor' ) ),
		),
		'photo'   => array(
			'title'       => __( 'Photo', 'create-not-learn-editor' ),
			'description' => __( 'One picture', 'create-not-learn-editor' ),
			'content'     => $image . "\n\n" . cnl_editor_post_kind_paragraph( __( 'Add a few words, if you like', 'create-not-learn-editor' ) ),
		),
		'gallery' => array(
			'title'       => __( 'Gallery', 'create-not-learn-editor' ),
			'description' => __( 'A set of photos', 'create-not-learn-editor' ),
			'content'     => $gallery . "\n\n" . cnl_editor_post_kind_paragraph( __( 'Add a few words, if you like', 'create-not-learn-editor' ) ),
		),
		'quote'   => array(
			'title'       => __( 'Quote', 'create-not-learn-editor' ),
			'description' => __( 'Words worth sharing', 'create-not-learn-editor' ),
			'content'     => "<!-- wp:quote -->\n<blockquote class=\"wp-block-quote\">" . cnl_editor_post_kind_paragraph( __( 'The words you’re quoting', 'create-not-learn-editor' ) ) . "</blockquote>\n<!-- /wp:quote -->\n\n" . cnl_editor_post_kind_paragraph( __( 'What do you make of it?', 'create-not-learn-editor' ) ),
		),
		'video'   => array(
			'title'       => __( 'Video', 'create-not-learn-editor' ),
			'description' => __( 'From YouTube or Vimeo', 'create-not-learn-editor' ),
			'content'     => cnl_editor_post_kind_paragraph( __( 'Paste a link to the video', 'create-not-learn-editor' ) ),
		),
	);
}

/**
 * Register the kinds of post as patterns.
 */
function cnl_editor_register_post_kinds() {
	register_block_pattern_category(
		'cnl-post-kinds',
		array(
			'label'       => __( 'Kinds of post', 'create-not-learn-editor' ),
			'description' => __( 'Ways to start a post, offered when writing one.', 'create-not-learn-editor' ),
		)
	);

	foreach ( cnl_editor_get_post_kinds() as $kind => $properties ) {
		register_block_pattern(
			'create-not-learn-editor/post-kind-' . $kind,
			array_merge(
				$properties,
				array(
					'categories' => array( 'cnl-post-kinds' ),
					'postTypes'  => array( 'post' ),
					'inserter'   => false,
				)
			)
		);
	}
}
