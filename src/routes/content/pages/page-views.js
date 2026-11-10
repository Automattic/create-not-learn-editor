/**
 * The views an opened page drills down to, in place of its summary. The
 * address says which, with `view`, so the breadcrumbs can lead back to the
 * summary.
 */

// Every detail about the page.
export const DETAILS_VIEW = 'details';

// What the homepage shows, for the homepage.
export const HOMEPAGE_VIEW = 'homepage';

// The layouts the page can use.
export const LAYOUT_VIEW = 'layout';

/**
 * The search string for a page's summary, without any view open.
 *
 * @param {Object} searchParams The route's search params.
 * @return {string} The search string, without a leading `?`.
 */
export function getPageSearchString( searchParams ) {
	const params = new URLSearchParams();

	Object.entries( searchParams ).forEach( ( [ key, value ] ) => {
		if ( key !== 'view' && value !== undefined && value !== null ) {
			params.set( key, String( value ) );
		}
	} );

	return params.toString();
}
