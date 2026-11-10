/**
 * The admin bar above the editor, which `includes/admin-bar.php` renders.
 *
 * Where the bar and the editor would offer the same thing twice, the bar's
 * version leads into the editor's own: its search opens the editor's command
 * palette, its links to editor screens open them in place, and New's Media
 * opens the editor's upload modal. A click on New itself only opens its menu.
 *
 * Imported package by package rather than through `src/wordpress-packages`,
 * as it is mounted from app init.
 */

/**
 * WordPress dependencies
 */
import { store as commandsStore } from '@wordpress/commands';
import { dispatch } from '@wordpress/data';
import { createRoot } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { openRoute } from './open-route';
import { UploadMediaModal } from './upload-media';

let uploadRoot;

/**
 * Open the editor's upload modal, the one the Media screen's Upload button
 * opens, over whatever screen is showing.
 */
function openUploadMedia() {
	if ( ! uploadRoot ) {
		const container = document.createElement( 'div' );
		document.body.append( container );
		uploadRoot = createRoot( container );
	}

	uploadRoot.render(
		<UploadMediaModal onClose={ () => uploadRoot.render( null ) } />
	);
}

/**
 * Open New's menu, as hovering does.
 *
 * Core's admin bar script toggles the menu on a tap, before this runs, and
 * on Enter, which never reaches here as a click. So a tap that closed it is
 * left closed, and a click otherwise only ever opens it.
 *
 * @param {Element} item New's menu item.
 */
function openNewMenu( item ) {
	if ( item.classList.contains( 'hover' ) ) {
		return;
	}

	item.classList.add( 'hover' );
	item.querySelector( ':scope > .ab-item' )?.setAttribute(
		'aria-expanded',
		'true'
	);
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

		if ( ! link ) {
			return;
		}

		// New goes nowhere of its own (see `includes/admin-bar.php`).
		if ( link.matches( '#wp-admin-bar-new-content > .ab-item' ) ) {
			event.preventDefault();
			openNewMenu( link.parentElement );
			return;
		}

		if ( event.metaKey || event.ctrlKey || event.shiftKey ) {
			return;
		}

		if ( link.closest( '#wp-admin-bar-new-media' ) ) {
			event.preventDefault();
			openUploadMedia();
			// Close the bar's hover menu.
			link.blur();
			link.closest( '.menupop' )?.classList.remove( 'hover' );
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
