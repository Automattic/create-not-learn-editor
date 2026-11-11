/**
 * Registers the editor's tools with WebMCP, so an agent working in the
 * browser can use them. See the README's "Driving the editor with WebMCP".
 *
 * Only their names, descriptions and inputs load with app init, and only
 * where the browser has WebMCP. What they do comes from the app-init-deferred
 * module, the first time one is called.
 */

/**
 * Internal dependencies
 */
import { loadDeferred } from '../app-init-deferred';
import { TOOLS } from './declarations';

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

	const tools = TOOLS.map( ( tool ) => ( {
		...tool,
		execute: async ( input ) => {
			const { runWebMcpTool } = await loadDeferred();
			const result = await runWebMcpTool( tool.name, readInput( input ) );

			return {
				content: [ { type: 'text', text: JSON.stringify( result ) } ],
			};
		},
	} ) );

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
