/**
 * The site's address as Home's header shows it.
 */

/*
 * Playground puts each site in a folder of its own, named for the session,
 * which means nothing to the person, so only the host is shown.
 */
const PLAYGROUND_HOST = 'playground.wordpress.net';

/**
 * The site's address the way people type it: no `https://`, no `www.` and
 * no slash at the end. Null when the URL can't be read.
 *
 * @param {string} url The site's home URL.
 * @return {?string} The address to show.
 */
export function getSiteAddress( url ) {
	let parsed;

	try {
		parsed = new URL( url );
	} catch {
		return null;
	}

	const host = parsed.host.replace( /^www\./, '' );

	if ( parsed.hostname.endsWith( PLAYGROUND_HOST ) ) {
		return host;
	}

	return host + parsed.pathname.replace( /\/+$/, '' );
}
