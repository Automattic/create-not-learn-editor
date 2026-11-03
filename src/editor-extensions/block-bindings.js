/**
 * Core's block bindings sources, in the editor.
 *
 * The server registers each source by name and label only. What reads and
 * writes a bound value in the editor, like the address of a menu link bound
 * to its page, is registered by core's own editors as they start, and the
 * lazy editor doesn't. Without it, every bound value reads as empty: a menu
 * link to a page shows "Link is empty", and a link added from a page search
 * looks broken, though the page and its address are saved.
 *
 * It can't simply be registered once at app init. The lazy editor loads the
 * editor's scripts later, and with them the server's sources again, one by
 * one, each replacing what was registered. So whenever a source is there
 * without it, it is registered once that batch is done: at app init, and
 * again after each such reload. A Gutenberg that registers it itself is
 * left to.
 *
 * Imported package by package rather than through `src/wordpress-packages`,
 * for the same reason as `template-part-editing.jsx`: this is registered from
 * app init, and the barrel would make the editor a static dependency of boot.
 */

/**
 * WordPress dependencies
 */
import {
	getBlockBindingsSources,
	store as blocksStore,
} from '@wordpress/blocks';
import { subscribe } from '@wordpress/data';
import { privateApis as editorPrivateApis } from '@wordpress/editor';

/**
 * Internal dependencies
 */
import { unlock } from '../lock-unlock';

// Those `registerCoreBlockBindingsSources` registers.
const CORE_SOURCES = [
	'core/pattern-overrides',
	'core/post-data',
	'core/post-meta',
	'core/term-data',
];

let isScheduled = false;

function isMissing() {
	const sources = getBlockBindingsSources();

	return CORE_SOURCES.some(
		( name ) => sources[ name ] && ! sources[ name ].getValues
	);
}

function registerWhenMissing() {
	if ( isScheduled || ! isMissing() ) {
		return;
	}

	isScheduled = true;
	// After the rest of the sources the server is adding.
	window.setTimeout( () => {
		isScheduled = false;

		if ( isMissing() ) {
			unlock( editorPrivateApis ).registerCoreBlockBindingsSources();
		}
	} );
}

export function registerBlockBindings() {
	registerWhenMissing();
	subscribe( registerWhenMissing, blocksStore );
}
