/**
 * The admin bar above the editor, behind the "Show the admin bar" preference.
 *
 * `includes/admin-bar.php` always renders the bar, hidden unless the body has
 * the `admin-bar` class, which it adds for those who have the preference on.
 * This keeps the class in step with the preference, so turning it on or off
 * in Preferences shows or hides the bar straight away.
 *
 * Where the bar and the editor would offer the same thing twice, the bar's
 * version leads into the editor's own: its search opens the editor's command
 * palette, and its links to editor screens, like New page, open them in place.
 *
 * Imported package by package rather than through `src/wordpress-packages`,
 * as it is mounted from app init.
 */

/**
 * WordPress dependencies
 */
import { store as commandsStore } from '@wordpress/commands';
import { dispatch, select, subscribe, useSelect } from '@wordpress/data';
import { store as preferencesStore } from '@wordpress/preferences';

/**
 * Internal dependencies
 */
import { openRoute } from './open-route';

export const ADMIN_BAR_PREFERENCES_SCOPE = 'create-not-learn-editor';
export const ADMIN_BAR_PREFERENCE = 'showAdminBar';

const getAdminBar = () => document.getElementById( 'wpadminbar' );

/**
 * @param {Function} registrySelect The registry's `select`.
 * @return {boolean} Whether the admin bar is on screen.
 */
function showsAdminBar( registrySelect ) {
	return (
		!! getAdminBar() &&
		!! registrySelect( preferencesStore ).get(
			ADMIN_BAR_PREFERENCES_SCOPE,
			ADMIN_BAR_PREFERENCE
		)
	);
}

/**
 * @return {boolean} Whether the admin bar is on screen.
 */
export function useShowsAdminBar() {
	return useSelect( showsAdminBar, [] );
}

/**
 * Lead the admin bar's ways into the editor to the editor's own.
 *
 * Its links to editor screens open them in place rather than loading the
 * editor again, which would lose unsaved changes.
 *
 * @param {Element} adminBar The admin bar.
 */
function connectAdminBar( adminBar ) {
	adminBar.addEventListener( 'click', ( event ) => {
		const link = event.target.closest( 'a' );

		if ( ! link || event.metaKey || event.ctrlKey || event.shiftKey ) {
			return;
		}

		if ( link.closest( '#wp-admin-bar-command-palette' ) ) {
			event.preventDefault();
			dispatch( commandsStore ).open();
			return;
		}

		const here = new URL( window.location.href );
		const url = new URL( link.href, here );
		const route = url.searchParams.get( 'p' );

		if (
			! route ||
			url.pathname !== here.pathname ||
			url.searchParams.get( 'page' ) !== here.searchParams.get( 'page' )
		) {
			return;
		}

		event.preventDefault();
		const [ path, query = '' ] = route.split( '?' );
		openRoute( path, Object.fromEntries( new URLSearchParams( query ) ) );
		// Close the bar's hover menu.
		link.blur();
	} );
}

/**
 * Set the preference up, and keep the bar in step with it.
 */
export function mountAdminBar() {
	dispatch( preferencesStore ).setDefaults( ADMIN_BAR_PREFERENCES_SCOPE, {
		[ ADMIN_BAR_PREFERENCE ]: false,
	} );

	const adminBar = getAdminBar();

	if ( ! adminBar ) {
		return;
	}

	connectAdminBar( adminBar );

	const sync = () =>
		document.body.classList.toggle( 'admin-bar', showsAdminBar( select ) );

	sync();
	subscribe( sync, preferencesStore );
}
