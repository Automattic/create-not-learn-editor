/**
 * External dependencies
 */
import { describe, expect, test } from 'vitest';

/**
 * Internal dependencies
 */
import { getPageBlockChanges, getPageTreeBlocks } from '../page-blocks';
import { buildPageTree } from '../page-tree';

const pages = [
	{ id: 1, menu_order: 0, parent: 0, title: 'Home' },
	{ id: 2, menu_order: 1, parent: 0, title: 'About' },
	{ id: 3, menu_order: 0, parent: 2, title: 'Team' },
	{ id: 4, menu_order: 2, parent: 0, title: 'Contact' },
];
const tree = buildPageTree( pages );
const options = {
	getTitle: ( page ) => page.title,
	homeId: 1,
	homeName: 'Homepage',
};

function ids( blocks ) {
	return blocks.map( ( block ) =>
		block.innerBlocks.length
			? { [ block.attributes.id ]: ids( block.innerBlocks ) }
			: ( block.attributes.id ?? 'home' )
	);
}

describe( 'getPageTreeBlocks', () => {
	test( 'lists pages as menu items, sub-pages under their parent', () => {
		const blocks = getPageTreeBlocks( tree, options );

		expect( ids( blocks ) ).toEqual( [ 1, { 2: [ 3 ] }, 4 ] );
		expect( blocks[ 0 ].attributes.label ).toBe( 'Homepage' );
		expect( blocks[ 1 ].name ).toBe( 'core/navigation-submenu' );
	} );

	test( 'leads with a Home link for a homepage that isn’t a page', () => {
		const blocks = getPageTreeBlocks( tree, {
			...options,
			hasHomeLink: true,
			homeId: 0,
		} );

		expect( blocks[ 0 ].name ).toBe( 'core/home-link' );
		expect( blocks[ 0 ].attributes.lock ).toEqual( {
			move: true,
			remove: true,
		} );
	} );

	// The block editor won't move a block locked against removal to another
	// parent, so a locked page couldn't be dragged under another page.
	test( 'leaves pages free to move under other pages', () => {
		const [ home, about ] = getPageTreeBlocks( tree, options );

		expect( home.attributes.lock ).toBeUndefined();
		expect( about.innerBlocks[ 0 ].attributes.lock ).toBeUndefined();
	} );

	test( 'fixes pages in place while only some are listed', () => {
		const [ home, about ] = getPageTreeBlocks( tree, {
			...options,
			isLocked: true,
		} );

		expect( home.attributes.lock ).toEqual( { move: true, remove: true } );
		expect( about.innerBlocks[ 0 ].attributes.lock ).toEqual( {
			move: true,
			remove: true,
		} );
	} );
} );

describe( 'getPageBlockChanges', () => {
	const blocks = getPageTreeBlocks( tree, { ...options, hasHomeLink: true } );

	/*
	 * The tree the pages make once the changes are saved, to check they put
	 * each page where it was dropped.
	 */
	function applyChanges( records, changes ) {
		return buildPageTree(
			records.map( ( page ) => ( {
				...page,
				...changes.find( ( change ) => change.id === page.id ),
			} ) )
		);
	}

	function treeIds( nodes ) {
		return nodes.map( ( node ) =>
			node.children.length
				? { [ node.page.id ]: treeIds( node.children ) }
				: node.page.id
		);
	}

	test( 'is empty when nothing moved', () => {
		expect( getPageBlockChanges( blocks, tree ) ).toEqual( [] );
	} );

	test( 'changes one page to move a page within a level', () => {
		const moved = [ blocks[ 0 ], blocks[ 1 ], blocks[ 3 ], blocks[ 2 ] ];
		const changes = getPageBlockChanges( moved, tree );

		expect( changes ).toHaveLength( 1 );
		expect( treeIds( applyChanges( pages, changes ) ) ).toEqual( [
			1,
			4,
			{ 2: [ 3 ] },
		] );
	} );

	test( 'moves a page under another, changing only that page', () => {
		const contact = blocks[ 3 ];
		const about = {
			...blocks[ 2 ],
			innerBlocks: [ ...blocks[ 2 ].innerBlocks, contact ],
		};

		expect(
			getPageBlockChanges( [ blocks[ 0 ], blocks[ 1 ], about ], tree )
		).toEqual( [ { id: 4, menu_order: 2, parent: 2 } ] );
	} );

	test( 'leaves the pages beside a moved page alone when none are in order', () => {
		// As on a new site, where pages are in title order.
		const unordered = [
			{ id: 1, menu_order: 0, parent: 0, title: 'Alpha' },
			{ id: 2, menu_order: 0, parent: 0, title: 'Bravo' },
			{ id: 3, menu_order: 0, parent: 0, title: 'Charlie' },
			{ id: 4, menu_order: 0, parent: 0, title: 'Delta' },
		];
		const unorderedTree = buildPageTree( unordered );
		const [ alpha, bravo, charlie, delta ] = getPageTreeBlocks(
			unorderedTree,
			options
		);
		const nested = [ { ...alpha, innerBlocks: [ delta ] }, bravo, charlie ];

		expect( getPageBlockChanges( nested, unorderedTree ) ).toEqual( [
			{ id: 4, menu_order: 0, parent: 1 },
		] );
	} );
} );
