/**
 * Make wp-admin's menu, which the page prints in place of the editor's own
 * sidebar (`includes/admin-menu.php`), work inside the editor.
 *
 * - Links to screens the editor has open them in place, through the router,
 *   and still open the editor on that screen in a new tab.
 * - The screen on show is marked current, as wp-admin marks it, which opens
 *   its menu's submenu in the column.
 * - The rest of what wp-admin's `common.js` does for the menu: submenus fly
 *   out on hover, "Collapse Menu" folds it and is remembered, and the admin
 *   bar's menu button opens it on small screens, as boot's own menu button
 *   does, since boot's sidebar is hidden.
 */

/**
 * WordPress dependencies
 */
import { flushSync } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { getItemIdForRoute } from '../../../src/menu-use';
import { openRoute } from '../../../src/open-route';

function getRoutePath() {
	const route =
		new URL( window.location.href ).searchParams.get( 'p' ) ?? '/';
	return route.split( '?' )[ 0 ];
}

/**
 * A link's URL relative to wp-admin, as the page's routes are keyed.
 *
 * @param {HTMLAnchorElement} link Menu link.
 * @return {string} Relative URL.
 */
function getAdminUrl( link ) {
	const url = new URL( link.getAttribute( 'href' ), window.location.href );
	return url.pathname.replace( /^.*\/wp-admin\//, '' ) + url.search;
}

/**
 * The editor's URL for a route, for opening it in a new tab.
 *
 * @param {string} route Route path.
 * @return {string} URL.
 */
function getEditorUrl( route ) {
	const url = new URL( window.location.href );
	url.search = '';
	url.hash = '';
	url.searchParams.set( 'page', 'create-not-learn-editor' );
	url.searchParams.set( 'p', route );
	return url.toString();
}

/**
 * Go to a route as boot's own links do: through the router, and at once, as
 * a link's click inside React is handled, so the screen being left unmounts
 * and hands back what it set before the next screen's editor starts. A layout's
 * canvas otherwise leaves core's patterns unlocked on the next screen. See
 * `docs/editor-workarounds.md`.
 *
 * @param {string} route Route path.
 */
function navigate( route ) {
	const router = window.__TSR_ROUTER__;

	flushSync( () => {
		if ( typeof router?.navigate === 'function' ) {
			router.navigate( { to: route } );
		} else {
			openRoute( route );
		}
	} );
}

function setClass( element, name, isOn ) {
	element?.classList.toggle( name, isOn );
}

/**
 * Mark the menu's link to a route current, and nothing else, with the
 * classes wp-admin's `_wp_menu_output()` gives the screen on show.
 *
 * @param {HTMLElement} menu The `#adminmenu` list.
 * @param {string}      path Route path.
 */
function markCurrent( menu, path ) {
	const links = Array.from( menu.querySelectorAll( 'a[data-cnl-route]' ) );
	const index = getItemIdForRoute(
		links.map( ( link, id ) => ( { id, to: link.dataset.cnlRoute } ) ),
		path
	);
	const link = index === null ? null : links[ index ];
	const currentTop = link?.closest( 'li.menu-top' );

	menu.querySelectorAll( 'li.menu-top' ).forEach( ( top ) => {
		const isCurrent = top === currentTop;
		const hasSubmenu = top.classList.contains( 'wp-has-submenu' );
		const topLink = top.querySelector( ':scope > a' );

		[ top, topLink ].forEach( ( element ) => {
			setClass(
				element,
				'wp-has-current-submenu',
				isCurrent && hasSubmenu
			);
			setClass(
				element,
				'wp-not-current-submenu',
				! isCurrent && hasSubmenu
			);
			setClass( element, 'current', isCurrent && ! hasSubmenu );
		} );
		setClass( top, 'wp-menu-open', isCurrent && hasSubmenu );
		setClass( top, 'opensub', false );
	} );

	menu.querySelectorAll( '.wp-submenu li' ).forEach( ( item ) => {
		item.classList.remove( 'current' );
		item.querySelector( 'a' )?.classList.remove( 'current' );
	} );
	menu.querySelectorAll( '[aria-current]' ).forEach( ( element ) =>
		element.removeAttribute( 'aria-current' )
	);

	if ( ! link ) {
		return;
	}

	// A menu's own link goes where its first submenu item does, which is
	// the one to mark.
	const current = link.closest( '.wp-submenu' )
		? link
		: currentTop.querySelector(
				`.wp-submenu a[data-cnl-route="${ link.dataset.cnlRoute }"]`
			) || link;

	current.classList.add( 'current' );
	current.closest( '.wp-submenu li' )?.classList.add( 'current' );
	current.setAttribute( 'aria-current', 'page' );
}

export function mountAdminMenu() {
	const menu = document.getElementById( 'adminmenu' );

	if ( ! menu ) {
		return;
	}

	const wrap = document.getElementById( 'wpwrap' );

	const routes = window.createNotLearnEditor?.adminMenuRoutes || {};

	menu.querySelectorAll( 'a[href]' ).forEach( ( link ) => {
		const route = routes[ getAdminUrl( link ) ];
		if ( route ) {
			link.dataset.cnlRoute = route;
			link.href = getEditorUrl( route );
		}
	} );

	menu.addEventListener( 'click', ( event ) => {
		const link = event.target.closest( 'a[data-cnl-route]' );
		if (
			! link ||
			event.button !== 0 ||
			event.metaKey ||
			event.ctrlKey ||
			event.shiftKey ||
			event.altKey
		) {
			return;
		}

		event.preventDefault();
		navigate( link.dataset.cnlRoute );
		link.blur();
		wrap?.classList.remove( 'wp-responsive-open' );
	} );

	// Submenus fly out beside the column, as hoverIntent opens them in wp-admin.
	menu.querySelectorAll( 'li.wp-has-submenu' ).forEach( ( item ) => {
		let timer;
		item.addEventListener( 'mouseenter', () => {
			window.clearTimeout( timer );
			item.classList.add( 'opensub' );
		} );
		item.addEventListener( 'mouseleave', () => {
			timer = window.setTimeout(
				() => item.classList.remove( 'opensub' ),
				150
			);
		} );
	} );

	const collapse = document.getElementById( 'collapse-button' );
	collapse?.setAttribute(
		'aria-expanded',
		String( ! document.body.classList.contains( 'folded' ) )
	);
	collapse?.addEventListener( 'click', () => {
		const isFolded = document.body.classList.toggle( 'folded' );
		collapse.setAttribute( 'aria-expanded', String( ! isFolded ) );
		window.setUserSetting?.( 'mfold', isFolded ? 'f' : 'o' );
	} );

	// On small screens: the admin bar's menu button, and boot's, open it,
	// and a click anywhere else closes it.
	const barToggle = document.querySelector( '#wp-admin-bar-menu-toggle a' );
	const bootToggleSelector = `button[aria-label="${ __(
		'Open navigation panel'
	) }"]`;
	const setOpen = ( isOpen ) => {
		wrap?.classList.toggle( 'wp-responsive-open', isOpen );
		barToggle?.setAttribute( 'aria-expanded', String( isOpen ) );
	};
	document.addEventListener(
		'click',
		( event ) => {
			const isOpen = !! wrap?.classList.contains( 'wp-responsive-open' );

			if (
				( barToggle && barToggle.contains( event.target ) ) ||
				event.target.closest( bootToggleSelector )
			) {
				event.preventDefault();
				event.stopPropagation();
				setOpen( ! isOpen );
			} else if ( isOpen && ! menu.contains( event.target ) ) {
				setOpen( false );
			}
		},
		true
	);

	// The router changes the URL without an event of its own.
	let markedFor = null;
	const sync = () => {
		const path = getRoutePath();
		if ( path !== markedFor ) {
			markedFor = path;
			markCurrent( menu, path );
		}
	};
	new window.MutationObserver( sync ).observe( document.body, {
		childList: true,
		subtree: true,
	} );
	window.addEventListener( 'popstate', sync );
	sync();
}
