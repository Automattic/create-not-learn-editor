<?php
/**
 * Compatibility with other plugins.
 *
 * @package CreateNotLearnEditor
 */

defined( 'ABSPATH' ) || exit;

/**
 * Register plugin compatibility hooks.
 */
function cnl_editor_register_plugin_compat_hooks() {
	add_filter( 'rest_pre_dispatch', 'cnl_editor_prepare_block_editor_assets_request', 10, 3 );
	add_action( CNL_EDITOR_SLUG . '_init', 'cnl_editor_enqueue_ai_webmcp' );
	add_filter( 'wpai_webmcp_screens', 'cnl_editor_add_ai_webmcp_screen' );
}

/**
 * Load the official AI plugin's WebMCP block tools into the full-page editor,
 * beside the editor's own (`src/webmcp/`), so an agent browser can work on
 * the canvas's blocks too.
 *
 * The AI plugin's WebMCP experiment only loads them on the post editor, from
 * `admin_enqueue_scripts`, which this page doesn't fire. Its feature registry
 * isn't public, so this finds the experiment's own handler on that hook,
 * which is only there while the experiment is on, and runs it for this page.
 */
function cnl_editor_enqueue_ai_webmcp() {
	global $wp_filter;

	$class = 'WordPress\AI\Experiments\WebMCP\WebMCP';

	if ( ! class_exists( $class ) || empty( $wp_filter['admin_enqueue_scripts'] ) ) {
		return;
	}

	foreach ( $wp_filter['admin_enqueue_scripts']->callbacks as $callbacks ) {
		foreach ( $callbacks as $callback ) {
			$handler = $callback['function'];

			if ( ! is_array( $handler ) || ! $handler[0] instanceof $class || 'enqueue_assets' !== $handler[1] ) {
				continue;
			}

			$handler[0]->enqueue_assets( CNL_EDITOR_SLUG );
			wp_add_inline_script( 'ai_' . $class::SCRIPT_HANDLE, cnl_editor_get_ai_webmcp_setup_script(), 'before' );
			return;
		}
	}
}

/**
 * Get the script that fits the AI plugin's WebMCP tools to this editor.
 *
 * The tools only register on a page with core's block editor body class,
 * which this page doesn't otherwise need, so it adds that.
 *
 * The canvas shows the page in its template, so the editor's top-level
 * blocks are the template's, and the page's own blocks sit inside Post
 * Content, as a header's do inside its template part. Those are controlled
 * inner blocks, which `editor-get-document` doesn't walk into, so an agent
 * would never learn their clientIds. This gives it the whole tree, saying
 * which blocks can't be edited until the person opens them, like the header.
 * The other tools look blocks up by clientId, so they work as they are.
 *
 * @return string JavaScript.
 */
function cnl_editor_get_ai_webmcp_setup_script() {
	return <<<'JS'
( function () {
	document.body.classList.add( 'block-editor-page' );

	const blockEditor = () => wp.data.select( 'core/block-editor' );
	const preview = ( attributes ) =>
		String( attributes?.content ?? '' )
			.replace( /<[^>]+>/g, '' )
			.replace( /\s+/g, ' ' )
			.trim()
			.slice( 0, 120 );
	const outline = ( rootClientId, depth ) =>
		blockEditor()
			.getBlocks( rootClientId )
			.flatMap( ( block ) => {
				const item = {
					clientId: block.clientId,
					name: block.name,
					depth,
					text: preview( block.attributes ),
				};
				if ( 'disabled' === blockEditor().getBlockEditingMode( block.clientId ) ) {
					item.locked = true;
				}
				return [ item, ...outline( block.clientId, depth + 1 ) ];
			} );

	wp.hooks.addFilter( 'wpai.webmcp.tools', 'create-not-learn-editor/outline', ( tools ) =>
		tools.map( ( tool ) =>
			'editor-get-document' !== tool.name
				? tool
				: {
						...tool,
						description:
							tool.description +
							' The outline includes the template around the post: the page\'s own blocks are inside core/post-content. Blocks marked locked, like the header and footer, can\'t be changed until the person opens them.',
						execute: async ( input ) => {
							const result = await tool.execute( input );
							const document = JSON.parse( result.content[ 0 ].text );
							document.blocks = outline( undefined, 0 );
							return { content: [ { type: 'text', text: JSON.stringify( document ) } ] };
						},
				  }
		)
	);
} )();
JS;
}

/**
 * Let the AI plugin's WebMCP experiment load on the full-page editor.
 *
 * @param string[] $screens Admin screens, by hook suffix, it loads on.
 * @return string[] The screens.
 */
function cnl_editor_add_ai_webmcp_screen( $screens ) {
	$screens[] = CNL_EDITOR_SLUG;

	return $screens;
}

/**
 * Let WooCommerce survive Gutenberg's block editor assets request.
 *
 * The editor loads its assets from `/wp-block-editor/v1/assets`, which fires
 * `admin_enqueue_scripts` inside a REST request. WooCommerce's handlers for it
 * call admin helpers, like `wc_get_page_screen_id()`, that WooCommerce only
 * loads on wp-admin requests, so the request dies with a fatal error and the
 * editor never loads. Load those helpers for this one request.
 *
 * @param mixed           $result  Response to short-circuit with, or null.
 * @param WP_REST_Server  $server  REST server.
 * @param WP_REST_Request $request Request.
 * @return mixed The response, untouched.
 */
function cnl_editor_prepare_block_editor_assets_request( $result, $server, $request ) {
	if (
		'/wp-block-editor/v1/assets' !== $request->get_route() ||
		function_exists( 'wc_get_page_screen_id' ) ||
		! function_exists( 'WC' )
	) {
		return $result;
	}

	$admin_functions = WC()->plugin_path() . '/includes/admin/wc-admin-functions.php';

	if ( file_exists( $admin_functions ) ) {
		require_once $admin_functions;
	}

	return $result;
}
