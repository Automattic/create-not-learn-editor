/**
 * System pages: the pages a site makes for itself, like the one people see
 * at an address with nothing there, or after they search. They look like
 * pages to the people visiting, but WordPress makes each from a template
 * rather than a page, so they are never in the list of pages.
 *
 * Pages lists them a step down from its own list, by these names, rather
 * than WordPress's, in the order here. Only those the theme or site has are
 * listed.
 */

/**
 * Internal dependencies
 */
import { getTemplateDisplayDescription } from '../../../records';
import {
	__,
	calendarIcon,
	categoryIcon,
	notFoundIcon,
	postListIcon,
	searchIcon,
	tagIcon,
	userIcon,
} from '../../../wordpress-packages';

// The `content` search value that opens them on Pages.
export const SYSTEM_PAGES_CONTENT = 'system';

const SYSTEM_PAGES = [
	{ icon: notFoundIcon, slug: '404', title: __( 'Page not found' ) },
	{ icon: searchIcon, slug: 'search', title: __( 'Search results' ) },
	{
		icon: categoryIcon,
		slug: 'category',
		title: __( 'Posts in a category' ),
	},
	{ icon: tagIcon, slug: 'tag', title: __( 'Posts with a tag' ) },
	{ icon: userIcon, slug: 'author', title: __( 'Posts by an author' ) },
	{ icon: calendarIcon, slug: 'date', title: __( 'Posts by date' ) },
];

const SYSTEM_PAGE_SLUGS = SYSTEM_PAGES.map( ( { slug } ) => slug );

/**
 * @param {Object} template Template record.
 * @return {boolean} Whether the template makes one of the system pages.
 */
export function isSystemPageTemplate( template ) {
	return SYSTEM_PAGE_SLUGS.includes( template?.slug );
}

/**
 * The system pages a site has, in the order they're listed.
 *
 * @param {Object[]} templates Template records.
 * @return {Object[]} The templates that make system pages.
 */
export function getSystemPageTemplates( templates ) {
	return templates
		.filter( isSystemPageTemplate )
		.sort(
			( a, b ) =>
				SYSTEM_PAGE_SLUGS.indexOf( a.slug ) -
				SYSTEM_PAGE_SLUGS.indexOf( b.slug )
		);
}

/**
 * How a system page is listed.
 *
 * @param {Object} template Template record.
 * @return {Object} `{ description, icon, title }`.
 */
export function getSystemPage( template ) {
	const page = SYSTEM_PAGES.find( ( { slug } ) => slug === template?.slug );

	return {
		description: getTemplateDisplayDescription( template ),
		icon: page?.icon || postListIcon,
		title: page?.title || '',
	};
}
