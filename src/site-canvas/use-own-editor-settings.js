/**
 * Editor settings a canvas gives core's editor for what it edits, handed back
 * when the canvas goes.
 *
 * The canvas passes them to the editor along with what it opens, so they are
 * in place from its first render. But core keeps its editor settings in one
 * store that every editor shares, and each editor merges its own over what is
 * there. A setting no other editor names would stay behind and follow into
 * the next one, so the values the editor had before the canvas came are put
 * back when it unmounts or stops asking for them.
 */

/**
 * WordPress dependencies
 */
import { store as editorStore } from '@wordpress/editor';

/**
 * Internal dependencies
 */
import { useLayoutEffect, useRegistry, useState } from '../wordpress-packages';

/**
 * @param {?Object} settings Editor settings the canvas asks for, or null.
 *                           Keep the reference stable: a new object hands
 *                           the old values back and asks again.
 */
export function useOwnEditorSettings( settings ) {
	const registry = useRegistry();

	/*
	 * Read as the canvas first renders, before the editor it renders has
	 * merged the settings in, from a layout effect of its own.
	 */
	const [ before ] = useState( () => {
		const current =
			registry.select( editorStore )?.getEditorSettings() || {};

		return Object.fromEntries(
			Object.keys( settings || {} ).map( ( key ) => [
				key,
				current[ key ],
			] )
		);
	} );

	/*
	 * A layout effect, so the values are handed back before the next
	 * editor's own layout effect merges its settings in, and before anything
	 * is drawn with ours.
	 */
	useLayoutEffect( () => {
		if ( ! settings ) {
			return undefined;
		}

		return () => {
			registry
				.dispatch( editorStore )
				.updateEditorSettings(
					Object.fromEntries(
						Object.keys( settings ).map( ( key ) => [
							key,
							before[ key ],
						] )
					)
				);
		};
	}, [ before, registry, settings ] );
}
