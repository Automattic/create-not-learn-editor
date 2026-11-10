/**
 * A page's address as a path on the site.
 */

/**
 * A page's address as people type it after the domain, like `/about`. The
 * homepage is `/` whatever its slug, which the caller knows, not the page.
 *
 * Worked out from the page's permalink template, so a draft shows where it
 * will be, and a page inside another shows its parent's part too.
 *
 * @param {Object} page Page record.
 * @return {string} The path.
 */
export function getPagePath( page ) {
	const slug = page.slug || page.generated_slug;
	const link =
		page.permalink_template && slug
			? page.permalink_template.replace( /%(?:page|post)name%/, slug )
			: page.link;

	if ( ! link ) {
		return '';
	}

	try {
		const url = new URL( link );
		const path = decodeURI( url.pathname ).replace( /\/+$/, '' );

		return ( path || '/' ) + url.search;
	} catch {
		return link;
	}
}
