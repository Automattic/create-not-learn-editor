/**
 * A trip from Home: the screens reached by picking something on Home, and
 * everything opened from them. On a trip, Back on any screen goes straight
 * to Home, wherever the screen sits, as Home is where the visit started.
 * The breadcrumbs still show where the screen sits.
 *
 * Picking something on Home starts a trip. Going somewhere from outside the
 * screen and the canvas, like the sidebar, the admin bar, the top bar or the
 * command palette, ends it, and so does reaching Home.
 *
 * The trip is kept in `sessionStorage`, as routes are bundled apart from
 * app init and each has its own copy of this module.
 */

const STORAGE_KEY = 'cnl-editor-home-trip';

/*
 * Where going somewhere else is a fresh start rather than a step further
 * on: the sidebar, the admin bar, the top bar and the command palette.
 */
const OUTSIDE_SELECTOR = [
	'#create-not-learn-editor-app [class*="__layout"] > [class*="__sidebar"]',
	'#wpadminbar',
	'.cnl-top-bar-host',
	'.commands-command-menu',
].join( ', ' );

/**
 * Start a trip from Home, as something on Home is picked.
 */
export function startHomeTrip() {
	try {
		window.sessionStorage.setItem( STORAGE_KEY, '1' );
	} catch {
		// Without storage, Back goes up a level instead.
	}
}

function endHomeTrip() {
	try {
		window.sessionStorage.removeItem( STORAGE_KEY );
	} catch {
		// Nothing kept to end.
	}
}

/**
 * Whether the screen on show was reached from Home.
 *
 * @return {boolean} Whether a trip from Home is under way.
 */
export function isOnHomeTrip() {
	try {
		return window.sessionStorage.getItem( STORAGE_KEY ) === '1';
	} catch {
		return false;
	}
}

function getRoutePath() {
	return (
		new URL( window.location.href ).searchParams.get( 'p' ) ?? '/'
	).split( '?' )[ 0 ];
}

/**
 * End the trip whenever the screen changes because of something picked
 * outside the screen and the canvas, or the screen is Home. Changes made
 * from the screen or the canvas, or by the browser's own Back, keep it.
 */
export function trackHomeTrip() {
	let isFromOutside = false;
	let routePath = getRoutePath();

	const notePick = ( event ) => {
		isFromOutside = Boolean( event.target.closest?.( OUTSIDE_SELECTOR ) );
	};

	document.addEventListener( 'pointerdown', notePick, true );
	document.addEventListener( 'keydown', notePick, true );

	const check = () => {
		const path = getRoutePath();

		if ( path === routePath ) {
			return;
		}

		routePath = path;

		if ( path === '/' || isFromOutside ) {
			endHomeTrip();
		}
	};

	let isScheduled = false;

	new window.MutationObserver( () => {
		if ( ! isScheduled ) {
			isScheduled = true;
			window.requestAnimationFrame( () => {
				isScheduled = false;
				check();
			} );
		}
	} ).observe( document.body, { childList: true, subtree: true } );

	window.addEventListener( 'popstate', check );

	// Opened afresh, rather than reloaded mid-trip, the editor starts
	// without one. Boot's router numbers the entry it opens on 0.
	if (
		routePath === '/' ||
		! ( Number( window.history.state?.__TSR_index ) > 0 )
	) {
		endHomeTrip();
	}
}
