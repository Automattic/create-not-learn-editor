/**
 * Workspaces: presentation presets for the kind of work being done.
 *
 * A workspace changes what the editor surfaces by default, never what the
 * user is allowed to do or what is stored. Roles answer "can this user do
 * this?"; workspaces answer "how should the editor present this work?".
 *
 * Surfaces read the active workspace's configuration rather than checking
 * its id, so a new workspace is a new entry in `WORKSPACES` (`presets.js`),
 * not a new branch in every surface. The sidebar is the same in every
 * workspace.
 *
 * The choice is a per-user editor preference, persisted to user meta by the
 * preferences store.
 *
 * A link can open the editor in a workspace with `&workspace=<id>`, such as
 * `admin.php?page=create-not-learn-editor&workspace=writing`, for demos and
 * for the end of an onboarding flow. It switches to that workspace as if it
 * had been picked from the switcher, so it stays picked afterwards.
 */

/**
 * WordPress dependencies
 */
import { dispatch, subscribe } from '@wordpress/data';
import { store as preferencesStore } from '@wordpress/preferences';

/**
 * Internal dependencies
 */
import {
	DEFAULT_WORKSPACE,
	PREFERENCE_NAME,
	PREFERENCES_SCOPE,
	WORKSPACES,
	findWorkspace,
	getActiveWorkspace,
	getAvailableWorkspaces,
	getWorkspace,
} from './presets';

export const WORKSPACE_PARAM = 'workspace';

export {
	DEFAULT_WORKSPACE,
	PREFERENCE_NAME,
	PREFERENCES_SCOPE,
	WORKSPACES,
	findWorkspace,
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
 * Switch to the workspace the editor's address names in `workspace`, then
 * take it out of the address, so a reload doesn't undo a switch made since.
 * One the site can't use, like Selling without a shop, is ignored.
 */
function switchToWorkspaceInUrl() {
	const url = new URL( window.location.href );
	const id = url.searchParams.get( WORKSPACE_PARAM );

	if ( id === null ) {
		return;
	}

	url.searchParams.delete( WORKSPACE_PARAM );
	window.history.replaceState( window.history.state, '', url );

	const workspace = findWorkspace( id );
	if ( workspace ) {
		setActiveWorkspace( workspace.id );
	}
}

/**
 * Apply the active workspace, now and whenever it changes: mark the body
 * with its id and set the defaults it gives core's preferences.
 */
export function mountWorkspaces() {
	dispatch( preferencesStore ).setDefaults( PREFERENCES_SCOPE, {
		[ PREFERENCE_NAME ]: DEFAULT_WORKSPACE.id,
	} );
	switchToWorkspaceInUrl();

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
	};

	apply();
	subscribe( apply, preferencesStore );
}
