/**
 * The admin bar above the editor, which `includes/admin-bar.php` renders.
 *
 * Where the bar and the editor would offer the same thing twice, the bar's
 * version leads into the editor's own: its search opens the editor's command
 * palette, and its links to editor screens open them in place.
 *
 * Imported package by package rather than through `src/wordpress-packages`,
 * as it is mounted from app init.
 */

/**
 * WordPress dependencies
 */
import { store as commandsStore } from '@wordpress/commands';
import { dispatch } from '@wordpress/data';

/**
 * Internal dependencies
 */
import { openRoute } from './open-route';

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
 * Lead the admin bar's ways into the editor to the editor's own, if it's on
 * the page.
 */
export function mountAdminBar() {
	const adminBar = document.getElementById( 'wpadminbar' );

	if ( adminBar ) {
		connectAdminBar( adminBar );
	}
}
