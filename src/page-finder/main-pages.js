/**
 * The site's main pages, for the page finder to open on: the pages at the top
 * level of the main menu, in its order, as visitors meet them.
 *
 * A menu that lists every page (a Page List block, the Auto menu) shows the
 * top-level published pages, so those stand in for it. So they do when the
 * site has no menu.
 *
 * Imported package by package rather than through `src/wordpress-packages`,
 * as the top bar is mounted from app init.
 */

/**
 * WordPress dependencies
 */
import { store as coreDataStore } from '@wordpress/core-data';
import { useSelect } from '@wordpress/data';
import { useMemo } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { getMainMenu } from '../routes/navigation/navigation-locations';
import {
	getBlockAttributes,
	getBlockName,
	getNavigationContentFromEditedRecord,
	getParsedBlocks,
} from '../routes/navigation-edit/navigation-blocks';

// The Menus screen's template part query (see `use-main-menu.js`), to share
// what core-data has fetched.
const TEMPLATE_PARTS_QUERY = {
	context: 'edit',
	per_page: 100,
	_fields: 'id,slug,title,area,status,content',
};

// Most recent first, as `getMainMenu` expects.
const MENUS_QUERY = {
	context: 'edit',
	per_page: 20,
	status: [ 'publish', 'draft' ],
};

// What a menu item at the top level can be, for the finder.
export const MENU_HOME = 'home';
export const MENU_ALL_PAGES = 'all-pages';

const LINK_BLOCKS = [ 'core/navigation-link', 'core/navigation-submenu' ];

/**
 * The top level of a menu: `MENU_HOME`, `MENU_ALL_PAGES` or a page ID for
 * each item that leads to a page, in order. Links elsewhere are left out.
 *
 * @param {string} content Serialized menu content.
 * @return {Array<string|number>} The items.
 */
export function getMenuTopLevel( content ) {
	const items = [];

	getParsedBlocks( content ).forEach( ( block ) => {
		const name = getBlockName( block );
		const attributes = getBlockAttributes( block );

		if ( name === 'core/home-link' ) {
			items.push( MENU_HOME );
		} else if ( name === 'core/page-list' ) {
			items.push( MENU_ALL_PAGES );
		} else if (
			LINK_BLOCKS.includes( name ) &&
			attributes.kind === 'post-type' &&
			( ! attributes.type || attributes.type === 'page' ) &&
			Number( attributes.id )
		) {
			items.push( Number( attributes.id ) );
		}
	} );

	return items;
}

/**
 * The main menu's top level, unsaved changes included.
 *
 * @return {?Array<string|number>} `getMenuTopLevel`'s items, or `null` while
 *                                 loading or when there is no menu.
 */
export function useMainMenuTopLevel() {
	const content = useSelect( ( select ) => {
		const store = select( coreDataStore );
		const menus = store.getEntityRecords(
			'postType',
			'wp_navigation',
			MENUS_QUERY
		);
		const parts = store.getEntityRecords(
			'postType',
			'wp_template_part',
			TEMPLATE_PARTS_QUERY
		);

		if ( ! menus || ! parts ) {
			return null;
		}

		const menu = getMainMenu( menus, parts );

		if ( ! menu ) {
			return null;
		}

		return getNavigationContentFromEditedRecord(
			store.getEditedEntityRecord( 'postType', 'wp_navigation', menu.id )
		);
	}, [] );

	return useMemo(
		() => ( content === null ? null : getMenuTopLevel( content ) ),
		[ content ]
	);
}

/**
 * The page IDs for the main pages, in order, the homepage left out, as the
 * finder always lists it first.
 *
 * @param {?Array} menuItems  `useMainMenuTopLevel`'s items.
 * @param {Object} pagesById  Page records by ID.
 * @param {Array}  tree       `getPageTree`'s entries, for the top-level pages.
 * @param {number} homepageId The homepage's page ID, or 0.
 * @return {number[]} Page IDs.
 */
export function getMainPageIds( menuItems, pagesById, tree, homepageId ) {
	const topLevelPublished = tree
		.filter(
			( { depth, page } ) => depth === 0 && page.status === 'publish'
		)
		.map( ( { page } ) => page.id );
	const items = menuItems?.length ? menuItems : [ MENU_ALL_PAGES ];
	const ids = [];

	items.forEach( ( item ) => {
		if ( item === MENU_ALL_PAGES ) {
			ids.push( ...topLevelPublished );
		} else if ( item !== MENU_HOME && pagesById.has( item ) ) {
			ids.push( item );
		}
	} );

	return [ ...new Set( ids ) ].filter( ( id ) => id !== homepageId );
}
