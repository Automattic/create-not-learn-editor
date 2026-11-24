/**
 * Frozen copies of thumbnails.
 *
 * A thumbnail loads the page's real front end once, then swaps it for a copy
 * of the page with its scripts taken out, and that copy is all the map keeps.
 * So a big site isn't dozens of running front ends at once, and a card coming
 * back on screen, or the map opened again, shows its page straight away.
 */

/*
 * Copies, by card, for as long as the editor is open. Each keeps the address
 * it was taken from, so a card whose page has moved loads again.
 */
const snapshots = new Map();
const listeners = new Set();

function emit() {
	listeners.forEach( ( listener ) => listener() );
}

/**
 * @param {string} id  Card ID.
 * @param {string} src The address the card loads.
 * @return {string} The card's frozen page, or an empty string.
 */
export function getSnapshot( id, src ) {
	const snapshot = snapshots.get( id );

	return snapshot?.src === src ? snapshot.html : '';
}

/**
 * Forget every copy, for when the pages may look different now.
 */
export function clearSnapshots() {
	if ( snapshots.size ) {
		snapshots.clear();
		emit();
	}
}

/**
 * @param {Function} listener Called when the copies are cleared.
 * @return {Function} Stops listening.
 */
export function subscribeToSnapshots( listener ) {
	listeners.add( listener );

	return () => listeners.delete( listener );
}

/**
 * Copy a loaded front end into a page that can't run scripts.
 *
 * Stylesheets stay linked rather than inlined, so their fonts and images
 * still resolve against the stylesheet's own address.
 *
 * @param {string}            id     Card ID.
 * @param {string}            src    The address the card loads.
 * @param {HTMLIFrameElement} iframe The loaded thumbnail.
 * @return {string} The frozen page, or an empty string if it can't be read.
 */
export function freezeThumbnail( id, src, iframe ) {
	let doc;

	try {
		doc = iframe.contentDocument;
	} catch {
		return '';
	}

	if ( ! doc?.documentElement ) {
		return '';
	}

	const html = doc.documentElement.cloneNode( true );

	html.querySelectorAll(
		'script, noscript, link[rel="modulepreload"]'
	).forEach( ( node ) => node.remove() );
	// Inline handlers have run already: a stylesheet's `onload` that swaps its
	// `media`, say, has left the swapped value behind to copy.
	html.querySelectorAll( '*' ).forEach( ( node ) => {
		for ( const { name } of [ ...node.attributes ] ) {
			if ( name.startsWith( 'on' ) ) {
				node.removeAttribute( name );
			}
		}
	} );

	const head = html.querySelector( 'head' );
	const base = doc.createElement( 'base' );
	base.href = doc.URL;
	head?.prepend( base );

	const frozen = `<!doctype html>${ html.outerHTML }`;
	snapshots.set( id, { html: frozen, src } );

	return frozen;
}
