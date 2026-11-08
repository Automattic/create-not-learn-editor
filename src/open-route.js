/*
 * The keys boot's router (TanStack Router) keeps in each history entry's
 * state: the entry's place in the history, and a key of its own.
 */
const INDEX_KEY = '__TSR_index';
const ENTRY_KEY = '__TSR_key';

/**
 * Open a screen from outside boot's router, the way the workspace switcher
 * does. The route's search params go inside `p`, after its path, as boot's
 * own links put them.
 *
 * Boot's router hears about a `pushState` only through a patch it puts on
 * `window.history`, and a patch can be lost, for example when the router is
 * made again and the old one restores the original. So the entry is added
 * with the browser's own `pushState`, numbered the way the router numbers
 * its own, and the router is told through `popstate`, which it always
 * listens for. Numbered one past the current entry, it reads as a step
 * forward, so Back returns to the screen this was opened from.
 *
 * @param {string} path   Route path.
 * @param {Object} search Route search params.
 */
export function openRoute( path, search = {} ) {
	const url = new URL( window.location.href );
	const query = new URLSearchParams(
		Object.entries( search ).map( ( [ key, value ] ) => [
			key,
			String( value ),
		] )
	).toString();

	url.searchParams.set( 'p', query ? `${ path }?${ query }` : path );

	const index = Number( window.history.state?.[ INDEX_KEY ] ) || 0;
	const key = Math.random().toString( 36 ).slice( 2, 10 );
	const state = { [ INDEX_KEY ]: index + 1, [ ENTRY_KEY ]: key, key };

	window.History.prototype.pushState.call( window.history, state, '', url );
	window.dispatchEvent( new window.PopStateEvent( 'popstate', { state } ) );
}
