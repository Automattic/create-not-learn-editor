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
} );

describe( 'getPageBlockChanges', () => {
	const blocks = getPageTreeBlocks( tree, { ...options, hasHomeLink: true } );

	test( 'is empty when nothing moved', () => {
		expect( getPageBlockChanges( blocks, tree ) ).toEqual( [] );
	} );

	test( 'renumbers a level a page moved within', () => {
		const moved = [ blocks[ 0 ], blocks[ 1 ], blocks[ 3 ], blocks[ 2 ] ];

		expect( getPageBlockChanges( moved, tree ) ).toEqual( [
			{ id: 4, menu_order: 1, parent: 0 },
			{ id: 2, menu_order: 2, parent: 0 },
		] );
	} );

	test( 'moves a page under another', () => {
		const contact = blocks[ 3 ];
		const about = {
			...blocks[ 2 ],
			innerBlocks: [ ...blocks[ 2 ].innerBlocks, contact ],
		};

		expect(
			getPageBlockChanges( [ blocks[ 0 ], blocks[ 1 ], about ], tree )
		).toEqual( [ { id: 4, menu_order: 1, parent: 2 } ] );
	} );
} );
