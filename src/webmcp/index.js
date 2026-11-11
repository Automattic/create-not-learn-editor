/**
 * Registers the editor's tools with WebMCP, so an agent working in the
 * browser can use them. See the README's "Driving the editor with WebMCP".
 *
 * Only their names, descriptions and inputs load with app init, and only
 * where the browser has WebMCP. What they do comes from the app-init-deferred
 * module, the first time one is called.
 */

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { loadDeferred } from '../app-init-deferred';
import { markConnected, noteToolCall, recordChange } from './connection';
import { TOOLS } from './declarations';

/*
 * Asked for with a block's `clientId` in `detail`, to show it changed, and
 * the `tool` that changed it. The AI plugin's WebMCP tools send it, from
 * `includes/plugin-compat.php`.
 */
export const SHOW_CHANGE_EVENT = 'cnl-editor-show-change';

// What the AI plugin's block tools change, in the person's words.
const AI_TOOL_CHANGES = {
	'editor-insert-block': __( 'Added a block' ),
	'editor-update-block-text': __( 'Changed some words' ),
	'editor-update-block-attributes': __( 'Changed a block' ),
	'editor-move-block': __( 'Moved a block' ),
	'editor-duplicate-block': __( 'Copied a block' ),
	'editor-transform-block': __( 'Changed a block' ),
};

function getModelContext() {
	return document.modelContext || window.navigator.modelContext || null;
}

function readInput( input ) {
	if ( typeof input === 'string' ) {
		try {
			return JSON.parse( input ) || {};
		} catch {
			return {};
		}
	}

	return input && typeof input === 'object' ? input : {};
}

/**
 * Register the tools, where the browser has WebMCP.
 */
export function registerWebMcpTools() {
	const modelContext = getModelContext();

	if ( ! modelContext ) {
		return;
	}

	// A browser an agent drives, such as Chrome DevTools MCP's, says so.
	if ( window.navigator.webdriver ) {
		markConnected();
	}

	const tools = TOOLS.map( ( tool ) => ( {
		...tool,
		execute: async ( input ) => {
			noteToolCall();

			const { runWebMcpTool } = await loadDeferred();
			const result = await runWebMcpTool( tool.name, readInput( input ) );

			return {
				content: [ { type: 'text', text: JSON.stringify( result ) } ],
			};
		},
	} ) );

	document.addEventListener( SHOW_CHANGE_EVENT, ( event ) => {
		const { clientId, tool } = event.detail || {};

		noteToolCall();
		recordChange(
			AI_TOOL_CHANGES[ tool ] || __( 'Changed a block' ),
			clientId
		);
		loadDeferred().then( ( { showWebMcpChange } ) =>
			showWebMcpChange( clientId )
		);
	} );

	if ( typeof modelContext.registerTool === 'function' ) {
		tools.forEach( ( tool ) => {
			try {
				modelContext.registerTool( tool )?.catch?.( () => {} );
			} catch {
				// Already registered, or refused: the others still go in.
			}
		} );
	} else if ( typeof modelContext.provideContext === 'function' ) {
		modelContext.provideContext( { tools } );
	}
}
