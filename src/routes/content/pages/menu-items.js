/**
 * Changes the Pages screen's switches make to the main menu.
 *
 * Each takes the menu's blocks and gives back new ones, leaving the old ones
 * as they were. An item is found with a `match` callback, so the same moves
 * work for a page's link and for a Home link standing for the homepage.
 *
 * A menu that is a Page List keeps updating itself: switching a page off
 * leaves it out of the block (`excludedPageIDs`) rather than turning the menu
 * into links. A menu of links has the page's link added or taken out.
 */

/**
 * Internal dependencies
 */
import {
	getBlockAttributes,
	getBlockName,
	getParsedBlocks,
} from '../../navigation-edit/navigation-blocks';

const EMPTY_ARRAY = [];

const LINK_BLOCKS = [ 'core/navigation-link', 'core/navigation-submenu' ];

/**
 * A menu's blocks in one shape, `{ name, attributes, innerBlocks }`, without
 * the whitespace between them.
 *
 * @param {Object[]} blocks Parsed or editor blocks.
 * @return {Object[]} Blocks.
 */
function normalizeBlocks( blocks ) {
	return ( blocks || EMPTY_ARRAY )
		.filter( ( block ) => getBlockName( block ) )
		.map( ( block ) => ( {
			attributes: { ...getBlockAttributes( block ) },
			innerBlocks: normalizeBlocks( block.innerBlocks ),
			name: getBlockName( block ),
		} ) );
}

/**
 * A menu's blocks, read from its content.
 *
 * @param {string} content Serialized menu content.
 * @return {Object[]} Blocks.
 */
export function getMenuBlocks( content ) {
	return normalizeBlocks( getParsedBlocks( content ) );
}

/**
 * Whether a menu item links to a page.
 *
 * @param {Object} block  Menu item.
 * @param {number} pageId Page ID.
 * @return {boolean} Whether it does.
 */
export function isPageItem( block, pageId ) {
	const attributes = getBlockAttributes( block );

	return (
		LINK_BLOCKS.includes( getBlockName( block ) ) &&
		attributes.kind === 'post-type' &&
		( ! attributes.type || attributes.type === 'page' ) &&
		Number( attributes.id ) === Number( pageId )
	);
}

/**
 * Whether a menu has a Page List block, and so lists every page by itself.
 *
 * @param {Object[]} blocks Menu blocks.
 * @return {boolean} Whether it does.
 */
export function hasPageList( blocks ) {
	return ( blocks || EMPTY_ARRAY ).some(
		( block ) =>
			getBlockName( block ) === 'core/page-list' ||
			hasPageList( block.innerBlocks )
	);
}

/**
 * The pages a menu's Page List leaves out.
 *
 * @param {Object[]} blocks Menu blocks.
 * @return {Set<number>} Page IDs.
 */
export function getExcludedPageIds( blocks ) {
	const ids = new Set();
	const visit = ( items ) =>
		( items || EMPTY_ARRAY ).forEach( ( block ) => {
			if ( getBlockName( block ) === 'core/page-list' ) {
				(
					getBlockAttributes( block ).excludedPageIDs || EMPTY_ARRAY
				).forEach( ( id ) => ids.add( Number( id ) ) );
			}

			visit( block.innerBlocks );
		} );

	visit( blocks );

	return ids;
}

/**
 * Leave a page out of a menu's Page List, or put it back.
 *
 * @param {Object[]} blocks     Menu blocks.
 * @param {number}   pageId     Page ID.
 * @param {boolean}  isExcluded Whether to leave it out.
 * @return {Object[]} New blocks.
 */
export function setPageExcluded( blocks, pageId, isExcluded ) {
	const id = Number( pageId );

	return ( blocks || EMPTY_ARRAY ).map( ( block ) => {
		if ( block.name !== 'core/page-list' ) {
			return block.innerBlocks?.length
				? {
						...block,
						innerBlocks: setPageExcluded(
							block.innerBlocks,
							pageId,
							isExcluded
						),
					}
				: block;
		}

		const current = ( block.attributes.excludedPageIDs || EMPTY_ARRAY ).map(
			Number
		);
		const next = current.filter( ( item ) => item !== id );

		if ( isExcluded ) {
			next.push( id );
		}

		const attributes = { ...block.attributes };

		if ( next.length ) {
			attributes.excludedPageIDs = next;
		} else {
			delete attributes.excludedPageIDs;
		}

		return { ...block, attributes };
	} );
}

/**
 * Where the first item matching a callback is: its index at each level.
 *
 * @param {Object[]} blocks Menu blocks.
 * @param {Function} match  Called with each item.
 * @return {?number[]} Path, or null when nothing matches.
 */
export function findItemPath( blocks, match ) {
	for ( let index = 0; index < ( blocks || EMPTY_ARRAY ).length; index++ ) {
		if ( match( blocks[ index ] ) ) {
			return [ index ];
		}

		const inner = findItemPath( blocks[ index ].innerBlocks, match );

		if ( inner ) {
			return [ index, ...inner ];
		}
	}

	return null;
}

function getItem( blocks, path ) {
	return path.reduce(
		( item, index, level ) =>
			level === 0 ? blocks[ index ] : item?.innerBlocks?.[ index ],
		null
	);
}

/**
 * A menu item with new items under it. A link with items under it is a
 * submenu, and a submenu that goes somewhere is a link once it has none.
 *
 * @param {Object}   block       Menu item.
 * @param {Object[]} innerBlocks Items under it.
 * @return {Object} New item.
 */
function withInnerBlocks( block, innerBlocks ) {
	let name = block.name;

	if ( name === 'core/navigation-link' && innerBlocks.length ) {
		name = 'core/navigation-submenu';
	} else if (
		name === 'core/navigation-submenu' &&
		! innerBlocks.length &&
		block.attributes.url
	) {
		name = 'core/navigation-link';
	}

	return { ...block, innerBlocks, name };
}

/**
 * Change the items at one level of a menu.
 *
 * @param {Object[]} blocks     Menu blocks.
 * @param {number[]} parentPath Path to the item they're under; empty for the
 *                              top level.
 * @param {Function} update     Given the items, returns new ones.
 * @return {Object[]} New blocks.
 */
function updateItems( blocks, parentPath, update ) {
	if ( ! parentPath.length ) {
		return update( blocks );
	}

	const [ index, ...rest ] = parentPath;

	return blocks.map( ( block, blockIndex ) =>
		blockIndex === index
			? withInnerBlocks(
					block,
					updateItems( block.innerBlocks, rest, update )
				)
			: block
	);
}

/**
 * Take an item out of a menu. The items under it move up to take its place,
 * rather than going with it.
 *
 * @param {Object[]} blocks Menu blocks.
 * @param {Function} match  Finds the item.
 * @return {Object[]} New blocks, the same ones when nothing matches.
 */
export function removeItem( blocks, match ) {
	const path = findItemPath( blocks, match );

	if ( ! path ) {
		return blocks;
	}

	const index = path[ path.length - 1 ];
	const item = getItem( blocks, path );

	return updateItems( blocks, path.slice( 0, -1 ), ( items ) => [
		...items.slice( 0, index ),
		...item.innerBlocks,
		...items.slice( index + 1 ),
	] );
}

/**
 * Add an item to a menu: at the end, or at the end of another item's
 * dropdown.
 *
 * @param {Object[]} blocks Menu blocks.
 * @param {Object}   item   Item to add.
 * @param {Function} under  Finds the item to put it under, if any.
 * @return {Object[]} New blocks.
 */
export function addItem( blocks, item, under ) {
	const path = under ? findItemPath( blocks, under ) : null;

	if ( ! path ) {
		return [ ...blocks, item ];
	}

	const parent = getItem( blocks, path );

	return updateItems( blocks, path.slice( 0, -1 ), ( items ) =>
		items.map( ( block, index ) =>
			index === path[ path.length - 1 ]
				? withInnerBlocks( parent, [ ...parent.innerBlocks, item ] )
				: block
		)
	);
}

/**
 * Add an item to the start of a menu.
 *
 * @param {Object[]} blocks Menu blocks.
 * @param {Object}   item   Item to add.
 * @return {Object[]} New blocks.
 */
export function addItemFirst( blocks, item ) {
	return [ item, ...blocks ];
}

/**
 * Where an item sits: how deep, and what is either side of and above it.
 *
 * @param {Object[]} blocks Menu blocks.
 * @param {Function} match  Finds the item.
 * @return {?Object} `{ depth, next, parent, previous }`, or null when it isn't
 *                   in the menu.
 */
export function getItemPlace( blocks, match ) {
	const path = findItemPath( blocks, match );

	if ( ! path ) {
		return null;
	}

	const index = path[ path.length - 1 ];
	const parent =
		path.length > 1 ? getItem( blocks, path.slice( 0, -1 ) ) : null;
	const siblings = parent ? parent.innerBlocks : blocks;

	return {
		depth: path.length - 1,
		next: siblings[ index + 1 ] || null,
		parent,
		previous: siblings[ index - 1 ] || null,
	};
}

/**
 * Move an item one place earlier or later among the items beside it.
 *
 * @param {Object[]} blocks    Menu blocks.
 * @param {Function} match     Finds the item.
 * @param {number}   direction -1 for earlier, 1 for later.
 * @return {Object[]} New blocks, the same ones when it can't move.
 */
export function moveItem( blocks, match, direction ) {
	const path = findItemPath( blocks, match );

	if ( ! path ) {
		return blocks;
	}

	const index = path[ path.length - 1 ];
	const target = index + direction;

	return updateItems( blocks, path.slice( 0, -1 ), ( items ) => {
		if ( target < 0 || target >= items.length ) {
			return items;
		}

		const next = [ ...items ];

		[ next[ index ], next[ target ] ] = [ next[ target ], next[ index ] ];

		return next;
	} );
}

/**
 * Whether an item can go under: links to pages and elsewhere can, a Page List
 * or a Home link can't.
 *
 * @param {Object} block Menu item.
 * @return {boolean} Whether it can.
 */
export function canHoldItems( block ) {
	return LINK_BLOCKS.includes( block?.name );
}

/**
 * Put an item in the dropdown of the item before it, at the end.
 *
 * @param {Object[]} blocks Menu blocks.
 * @param {Function} match  Finds the item.
 * @return {Object[]} New blocks, the same ones when it can't move.
 */
export function indentItem( blocks, match ) {
	const path = findItemPath( blocks, match );
	const index = path?.[ path.length - 1 ];

	if ( ! path || ! index ) {
		return blocks;
	}

	const item = getItem( blocks, path );

	return updateItems( blocks, path.slice( 0, -1 ), ( items ) => {
		if ( ! canHoldItems( items[ index - 1 ] ) ) {
			return items;
		}

		const previous = items[ index - 1 ];

		return [
			...items.slice( 0, index - 1 ),
			withInnerBlocks( previous, [ ...previous.innerBlocks, item ] ),
			...items.slice( index + 1 ),
		];
	} );
}

/**
 * Take an item out of the dropdown it is in, to sit just after it.
 *
 * @param {Object[]} blocks Menu blocks.
 * @param {Function} match  Finds the item.
 * @return {Object[]} New blocks, the same ones when it isn't in a dropdown.
 */
export function outdentItem( blocks, match ) {
	const path = findItemPath( blocks, match );

	if ( ! path || path.length < 2 ) {
		return blocks;
	}

	const index = path[ path.length - 1 ];
	const parentIndex = path[ path.length - 2 ];
	const item = getItem( blocks, path );

	return updateItems( blocks, path.slice( 0, -2 ), ( items ) => {
		const parent = items[ parentIndex ];

		return [
			...items.slice( 0, parentIndex ),
			withInnerBlocks(
				parent,
				parent.innerBlocks.filter(
					( block, blockIndex ) => blockIndex !== index
				)
			),
			item,
			...items.slice( parentIndex + 1 ),
		];
	} );
}
