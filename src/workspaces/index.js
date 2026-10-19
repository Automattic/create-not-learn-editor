/**
 * Workspaces: presentation presets for the kind of work being done.
 *
 * A workspace changes what the editor surfaces by default, never what the
 * user is allowed to do or what is stored. Roles answer "can this user do
 * this?"; workspaces answer "how should the editor present this work?".
 *
 * Surfaces read the active workspace's configuration rather than checking
 * its id, so a new workspace is a new entry in `WORKSPACES` (`presets.js`),
 * not a new branch in every surface. This module applies the sidebar side.
 *
 * The choice is a per-user editor preference, persisted to user meta by the
 * preferences store.
 */

/**
 * WordPress dependencies
 */
import { store as bootStore } from '@wordpress/boot';
import { dispatch, select, subscribe } from '@wordpress/data';
import { store as preferencesStore } from '@wordpress/preferences';

/**
 * Internal dependencies
 */
import {
	DEFAULT_WORKSPACE,
	PREFERENCE_NAME,
	PREFERENCES_SCOPE,
	WORKSPACES,
	getActiveWorkspace,
	getAvailableWorkspaces,
	getMenuItemChanges,
	getWorkspace,
} from './presets';

export {
	DEFAULT_WORKSPACE,
	PREFERENCE_NAME,
	PREFERENCES_SCOPE,
	WORKSPACES,
	getActiveWorkspace,
	getAvailableWorkspaces,
	getWorkspace,
};

/**
 * Switch the active workspace.
 *
 * @param {string} id Workspace id.
 */
export function setActiveWorkspace( id ) {
	dispatch( preferencesStore ).set(
		PREFERENCES_SCOPE,
		PREFERENCE_NAME,
		getWorkspace( id ).id
	);
}

/**
 * Reset the app to the home route.
 *
 * Boot has no public navigation API reachable from outside its own router
 * tree, but its router keeps itself in sync by patching the native
 * `window.history.pushState`/`replaceState`, so driving those directly is
 * how code outside the tree - like the workspace switcher - moves it.
 */
export function resetRouteToHome() {
	const url = new URL( window.location.href );
	url.searchParams.set( 'p', '/' );
	window.history.pushState( null, '', url );
}

/**
 * Apply the active workspace to boot's sidebar, now and whenever it changes.
 *
 * Every item any workspace touches is reset to its registered definition
 * before the active workspace's changes are layered on, so switching back
 * undoes them. Must run after boot has registered its menu items.
 */
export function mountWorkspaces() {
	dispatch( preferencesStore ).setDefaults( PREFERENCES_SCOPE, {
		[ PREFERENCE_NAME ]: DEFAULT_WORKSPACE.id,
	} );

	/*
	 * The registered value of every property any workspace changes, per item,
	 * including properties the item was registered without.
	 */
	const registered = select( bootStore ).getMenuItems();
	const changesByWorkspace = Object.fromEntries(
		WORKSPACES.map( ( workspace ) => [
			workspace.id,
			getMenuItemChanges( workspace, registered ),
		] )
	);
	const originals = {};
	WORKSPACES.forEach( ( workspace ) => {
		Object.entries( changesByWorkspace[ workspace.id ] ).forEach(
			( [ id, changes ] ) => {
				const item = registered.find(
					( { id: itemId } ) => itemId === id
				);

				if ( ! item ) {
					return;
				}

				originals[ id ] = originals[ id ] || {};
				Object.keys( changes ).forEach( ( key ) => {
					originals[ id ][ key ] = item[ key ];
				} );
			}
		);
	} );

	let appliedId;
	const apply = () => {
		const workspace = getActiveWorkspace();

		if ( workspace.id === appliedId ) {
			return;
		}
		appliedId = workspace.id;

		document.body.dataset.cnlWorkspace = workspace.id;
		// Core's own preference, so a choice made on the step itself wins.
		dispatch( preferencesStore ).setDefaults( 'core', {
			isPublishSidebarEnabled: workspace.publishStep,
		} );
		document.body.classList.toggle(
			'cnl-pin-last-menu-section',
			!! workspace.pinLastMenuSection
		);
		Object.keys( originals ).forEach( ( id ) => {
			dispatch( bootStore ).updateMenuItem( id, {
				...originals[ id ],
				...changesByWorkspace[ workspace.id ][ id ],
			} );
		} );
	};

	apply();
	subscribe( apply, preferencesStore );
}
