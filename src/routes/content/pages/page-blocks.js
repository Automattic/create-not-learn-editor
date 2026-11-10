/**
 * The site's pages as blocks, for the list view the Menus screen uses, and the
 * page moves a change to them makes.
 *
 * Each page is a menu item block: a link, or a submenu when it has pages
 * under it. Nothing here is a menu. The blocks only let the Pages screen show
 * and reorder its pages with the same list as Menus.
 */

/**
 * Internal dependencies
 */
import { getLevelChanges } from './page-tree';

const EMPTY_ARRAY = [];

/*
 * Pages aren't locked against removal, as the block editor won't move a block
 * locked that way to another parent, so it couldn't go under another page. The
 * list keeps them from being removed instead.
 */
const FIXED_ITEM_LOCK = { move: true, remove: true };

/**
 * A page as a menu item, with its sub-pages under it.
 *
 * @param {Object}   node             Tree node, `{ page, children }`.
 * @param {Object}   options
 * @param {Function} options.getTitle Returns a page's plain title.
 * @param {number}   options.homeId   The page shown as the homepage.
 * @param {string}   options.homeName What the homepage is called.
 * @param {boolean}  options.isLocked Whether it stays where it is.
 * @return {Object} Block, `{ name, attributes, innerBlocks }`.
 */
function getPageBlock( node, options ) {
	const id = Number( node.page.id );
	const innerBlocks = node.children.map( ( child ) =>
		getPageBlock( child, options )
	);

	return {
		attributes: {
			id,
			kind: 'post-type',
			label:
				id === options.homeId
					? options.homeName
					: options.getTitle( node.page ),
			...( options.isLocked && { lock: FIXED_ITEM_LOCK } ),
			type: 'page',
			url: node.page.link || '',
		},
		innerBlocks,
		name: innerBlocks.length
			? 'core/navigation-submenu'
			: 'core/navigation-link',
	};
}

/**
 * Every page as a menu item, in page order, sub-pages under their parents.
 * A homepage that isn't a page, like the latest posts, leads as a Home link.
 *
 * @param {Object[]} tree                Tree from `buildPageTree`.
 * @param {Object}   options
 * @param {Function} options.getTitle    Returns a page's plain title.
 * @param {number}   options.homeId      The page shown as the homepage.
 * @param {string}   options.homeName    What the homepage is called.
 * @param {boolean}  options.hasHomeLink Whether to lead with a Home link.
 * @param {boolean}  options.isLocked    Whether pages stay where they are.
 * @return {Object[]} Blocks.
 */
export function getPageTreeBlocks( tree, options ) {
	const blocks = tree.map( ( node ) => getPageBlock( node, options ) );

	if ( ! options.hasHomeLink ) {
		return blocks;
	}

	return [
		{
			attributes: { label: options.homeName, lock: FIXED_ITEM_LOCK },
			innerBlocks: [],
			name: 'core/home-link',
		},
		...blocks,
	];
}

function getPageId( block ) {
	return block?.name === 'core/home-link'
		? 0
		: Number( block?.attributes?.id ) || 0;
}

/**
 * The page moves a change to the blocks makes: a new parent, and menu orders
 * that put each page in its place, changing as few pages as can. Levels whose
 * pages are as they were are left alone.
 *
 * @param {Object[]} blocks                Blocks after the change.
 * @param {Object[]} tree                  Tree from `buildPageTree`, before it.
 * @param {Object}   [options]
 * @param {number}   [options.frontPageId] ID of the page set as the homepage.
 * @return {Object[]} `{ id, parent, menu_order }` for each page that changes.
 */
export function getPageBlockChanges( blocks, tree, { frontPageId = 0 } = {} ) {
	const before = new Map();
	const pages = new Map();
	const visitTree = ( nodes, parent ) => {
		before.set(
			parent,
			nodes.map( ( node ) => Number( node.page.id ) )
		);
		nodes.forEach( ( node ) => {
			pages.set( Number( node.page.id ), node.page );
			visitTree( node.children, Number( node.page.id ) );
		} );
	};

	visitTree( tree, 0 );

	const changes = [];
	const visitBlocks = ( items, parent ) => {
		const ids = ( items || EMPTY_ARRAY )
			.map( getPageId )
			.filter( ( id ) => pages.has( id ) );
		const previous = before.get( parent ) || EMPTY_ARRAY;

		if ( ids.join( ',' ) !== previous.join( ',' ) ) {
			changes.push(
				...getLevelChanges(
					ids.map( ( id ) => pages.get( id ) ),
					parent,
					{ frontPageId, previousIds: previous }
				)
			);
		}

		( items || EMPTY_ARRAY ).forEach( ( block ) => {
			const id = getPageId( block );

			visitBlocks( block.innerBlocks, pages.has( id ) ? id : parent );
		} );
	};

	visitBlocks( blocks, 0 );

	return changes;
}
