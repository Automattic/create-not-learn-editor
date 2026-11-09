/**
 * Which pages visitors can reach from the site's main menu.
 */

/**
 * Internal dependencies
 */
import {
	getBlockAttributes,
	getBlockName,
	getParsedBlocks,
} from '../navigation-edit/navigation-blocks';

const LINK_BLOCKS = [ 'core/navigation-link', 'core/navigation-submenu' ];

/**
 * Read a menu's blocks for the pages they link to.
 *
 * A Page List block links every published page, so a menu that contains one
 * is reported as listing all pages rather than by ID, along with the pages it
 * leaves out.
 *
 * @param {Object[]} blocks Parsed or editor blocks.
 * @return {{ excludedPageIds: Set<number>, listsAllPages: boolean, pageIds: Set<number> }} Menu pages.
 */
export function getMenuPagesFromBlocks( blocks ) {
	const pageIds = new Set();
	const excludedPageIds = new Set();
	let listsAllPages = false;

	const visit = ( items ) => {
		( items || [] ).forEach( ( block ) => {
			const name = getBlockName( block );
			const attributes = getBlockAttributes( block );

			if ( name === 'core/page-list' ) {
				listsAllPages = true;
				( attributes.excludedPageIDs || [] ).forEach( ( id ) =>
					excludedPageIds.add( Number( id ) )
				);
			}

			if (
				LINK_BLOCKS.includes( name ) &&
				attributes.kind === 'post-type' &&
				( ! attributes.type || attributes.type === 'page' ) &&
				Number( attributes.id )
			) {
				pageIds.add( Number( attributes.id ) );
			}

			visit( block.innerBlocks );
		} );
	};

	visit( blocks );

	return { excludedPageIds, listsAllPages, pageIds };
}

/**
 * Read a menu's content for the pages it links to.
 *
 * @param {string} content Serialized navigation menu content.
 * @return {{ excludedPageIds: Set<number>, listsAllPages: boolean, pageIds: Set<number> }} Menu pages.
 */
export function getMenuPages( content ) {
	return getMenuPagesFromBlocks( getParsedBlocks( content ) );
}

/**
 * Whether a Page List block leaves a page out, itself or with a page above
 * it, as Page List never shows a page whose parent it doesn't show.
 *
 * @param {Object}   page        Page record.
 * @param {Set}      excludedIds Pages left out.
 * @param {Object[]} pages       Every page, to find the ones above it.
 * @return {boolean} Whether the page is left out.
 */
export function isPageExcluded( page, excludedIds, pages = [] ) {
	if ( ! page || ! excludedIds?.size ) {
		return false;
	}

	const byId = new Map(
		pages.map( ( item ) => [ Number( item.id ), item ] )
	);
	const seen = new Set();
	let current = page;

	while ( current && ! seen.has( Number( current.id ) ) ) {
		if ( excludedIds.has( Number( current.id ) ) ) {
			return true;
		}

		seen.add( Number( current.id ) );
		current = byId.get( Number( current.parent ) || 0 );
	}

	return false;
}

/**
 * Whether a page shows up in the main menu.
 *
 * @param {Object}   page      Page record.
 * @param {Object}   menuPages Result of `getMenuPages`.
 * @param {Object[]} pages     Every page, so pages under one the menu leaves
 *                             out are left out too.
 * @return {boolean} Whether the page is in the menu.
 */
export function isPageInMenu( page, menuPages, pages = [] ) {
	if ( ! page || ! menuPages ) {
		return false;
	}

	if ( menuPages.pageIds.has( Number( page.id ) ) ) {
		return true;
	}

	// Page List shows published pages, with sub-pages in submenus, less the
	// ones it leaves out.
	return (
		menuPages.listsAllPages &&
		page.status === 'publish' &&
		! isPageExcluded( page, menuPages.excludedPageIds, pages )
	);
}
