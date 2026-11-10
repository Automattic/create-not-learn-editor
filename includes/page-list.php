<?php
/**
 * Pages kept out of a Page List block.
 *
 * A menu that is only a Page List block updates itself: every published page
 * is in it, in page order. The Pages screen keeps menus like that for as long
 * as it can, so switching a page off there leaves it out of the Page List
 * rather than turning the menu into links set by hand. The block has no way to
 * leave a page out, so this adds one: an `excludedPageIDs` attribute, honoured
 * when the block renders. A page left out takes the pages under it with it, as
 * Page List never shows a page whose parent it doesn't show.
 *
 * The editor's side is `src/editor-extensions/page-list-excluded-pages.jsx`.
 *
 * @package CreateNotLearnEditor
 */

defined( 'ABSPATH' ) || exit;

/**
 * Register Page List hooks.
 */
function cnl_editor_register_page_list_hooks() {
	add_filter( 'register_block_type_args', 'cnl_editor_page_list_block_args', 10, 2 );
}

/**
 * Give the Page List block its `excludedPageIDs` attribute, and render it
 * without those pages.
 *
 * @param array  $args       Block type arguments.
 * @param string $block_type Block type name.
 * @return array Block type arguments.
 */
function cnl_editor_page_list_block_args( $args, $block_type ) {
	if ( 'core/page-list' !== $block_type ) {
		return $args;
	}

	$args['attributes'] = isset( $args['attributes'] ) && is_array( $args['attributes'] ) ? $args['attributes'] : array();

	$args['attributes']['excludedPageIDs'] = array(
		'type'    => 'array',
		'items'   => array( 'type' => 'integer' ),
		'default' => array(),
	);

	if ( isset( $args['render_callback'] ) && is_callable( $args['render_callback'] ) ) {
		$render                  = $args['render_callback'];
		$args['render_callback'] = static function ( $attributes, $content, $block ) use ( $render ) {
			return cnl_editor_render_page_list( $render, $attributes, $content, $block );
		};
	}

	return $args;
}

/**
 * The page IDs a Page List block leaves out.
 *
 * @param array $attributes Block attributes.
 * @return int[] Page IDs.
 */
function cnl_editor_get_page_list_excluded_ids( $attributes ) {
	$ids = isset( $attributes['excludedPageIDs'] ) && is_array( $attributes['excludedPageIDs'] )
		? $attributes['excludedPageIDs']
		: array();

	return array_values( array_filter( array_map( 'absint', $ids ) ) );
}

/**
 * Render a Page List block without the pages it leaves out.
 *
 * The block gets its pages from `get_pages()`, so they are taken out of what
 * that returns, for this block only.
 *
 * @param callable $render     The block's own render callback.
 * @param array    $attributes Block attributes.
 * @param string   $content    Block content.
 * @param WP_Block $block      Block instance.
 * @return string Rendered block.
 */
function cnl_editor_render_page_list( $render, $attributes, $content, $block ) {
	$excluded = cnl_editor_get_page_list_excluded_ids( $attributes );

	if ( ! $excluded ) {
		return call_user_func( $render, $attributes, $content, $block );
	}

	$filter = static function ( $pages ) use ( $excluded ) {
		return array_values(
			array_filter(
				(array) $pages,
				static function ( $page ) use ( $excluded ) {
					return ! in_array( (int) $page->ID, $excluded, true );
				}
			)
		);
	};

	add_filter( 'get_pages', $filter );

	try {
		return call_user_func( $render, $attributes, $content, $block );
	} finally {
		remove_filter( 'get_pages', $filter );
	}
}
