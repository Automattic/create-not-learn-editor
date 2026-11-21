/**
 * Plugin sidebars, which stay core's complementary areas: opening one, by the
 * Plugins menu or by the plugin itself, makes it the active area, and the
 * stylesheet shows the area beside the canvas. See `README.md`.
 */

/**
 * WordPress dependencies
 */
import { dispatch, select, useSelect } from '@wordpress/data';
import { store as preferencesStore } from '@wordpress/preferences';

// By name: `@wordpress/interface` is bundled into the editor script, not a
// package of its own, so importing it would register a second store.
export const INTERFACE_STORE = 'core/interface';
export const SCOPE = 'core';

// Core's own areas, which aren't plugins'.
const CORE_AREAS = /^(edit-post|edit-site|core|editor)\//;

// CnL's own panel, for what plugins add to a page's settings.
export const SETTINGS_SIDEBAR = 'create-not-learn-editor-plugin-ui/settings';

export const PREFERENCES_SCOPE = 'create-not-learn-editor';
const PINNED_KEY = 'pinnedPluginSidebars';

/**
 * How many pinned plugins fit beside the Plugins button, by the window's
 * width, so the toolbar never overflows: two on a wide screen, one on a
 * tablet and none on a phone, where the Plugins button is the way in.
 *
 * @param {number} width The window's width.
 * @return {number} How many to show.
 */
export function getPinnedLimit( width = window.innerWidth ) {
	if ( width >= 1280 ) {
		return 2;
	}
	return width >= 782 ? 1 : 0;
}

export const MAX_PINNED = 2;

export function isPluginArea( identifier ) {
	return !! identifier && ! CORE_AREAS.test( identifier );
}

export function useActivePluginSidebar() {
	return useSelect( ( selectStore ) => {
		const area =
			selectStore( INTERFACE_STORE )?.getActiveComplementaryArea( SCOPE );
		return isPluginArea( area ) ? area : null;
	}, [] );
}

export function toggleSidebar( identifier ) {
	const store = dispatch( INTERFACE_STORE );
	const active =
		select( INTERFACE_STORE ).getActiveComplementaryArea( SCOPE );
	if ( active === identifier ) {
		store.disableComplementaryArea( SCOPE );
	} else {
		store.enableComplementaryArea( SCOPE, identifier );
	}
}

export function usePinnedSidebars() {
	return useSelect(
		( selectStore ) =>
			selectStore( preferencesStore ).get(
				PREFERENCES_SCOPE,
				PINNED_KEY
			) ?? [],
		[]
	);
}

/**
 * Pins or unpins a plugin's sidebar beside the Plugins button. CnL's own
 * preference rather than core's `pinnedItems`, which pins every plugin by
 * default and is shared with WordPress's other editors.
 *
 * @param {string} identifier The sidebar.
 */
export function togglePinned( identifier ) {
	const pinned =
		select( preferencesStore ).get( PREFERENCES_SCOPE, PINNED_KEY ) ?? [];
	const next = pinned.includes( identifier )
		? pinned.filter( ( id ) => id !== identifier )
		: [ ...pinned, identifier ].slice( -MAX_PINNED );
	dispatch( preferencesStore ).set( PREFERENCES_SCOPE, PINNED_KEY, next );
}
