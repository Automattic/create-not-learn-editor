/**
 * External dependencies
 */
import { describe, expect, test, vi } from 'vitest';

vi.mock( '@wordpress/blocks', () => ( {
	createBlock: vi.fn(),
} ) );

/**
 * Internal dependencies
 */
import {
	addItem,
	getExcludedPageIds,
	getItemPlace,
	getMenuBlocks,
	hasPageList,
	indentItem,
	isPageItem,
	moveItem,
	outdentItem,
	removeItem,
	setPageExcluded,
} from '../menu-items';

function link( id, innerBlocks = [] ) {
	return {
		attributes: { id, kind: 'post-type', label: `Page ${ id }`, url: '/' },
		innerBlocks,
		name: innerBlocks.length
			? 'core/navigation-submenu'
			: 'core/navigation-link',
	};
}

function shape( blocks ) {
	return blocks.map( ( block ) =>
		block.innerBlocks.length
			? { [ block.attributes.id ]: shape( block.innerBlocks ) }
			: block.attributes.id
	);
}

const page = ( id ) => ( block ) => isPageItem( block, id );

describe( 'getMenuBlocks', () => {
	test( 'reads a menu, skipping the space between items', () => {
		const blocks = getMenuBlocks(
			'<!-- wp:page-list {"excludedPageIDs":[4]} /-->\n\n<!-- wp:home-link /-->'
		);

		expect( blocks.map( ( block ) => block.name ) ).toEqual( [
			'core/page-list',
			'core/home-link',
		] );
		expect( getExcludedPageIds( blocks ) ).toEqual( new Set( [ 4 ] ) );
		expect( hasPageList( blocks ) ).toBe( true );
	} );
} );

describe( 'setPageExcluded', () => {
	const blocks = getMenuBlocks( '<!-- wp:page-list /-->' );

	test( 'leaves a page out, then puts it back', () => {
		const out = setPageExcluded( blocks, 4, true );

		expect( out[ 0 ].attributes.excludedPageIDs ).toEqual( [ 4 ] );
		expect(
			setPageExcluded( out, 4, false )[ 0 ].attributes
		).not.toHaveProperty( 'excludedPageIDs' );
	} );
} );

describe( 'removeItem', () => {
	test( 'moves the items under it up into its place', () => {
		const blocks = [ link( 1 ), link( 2, [ link( 3 ), link( 4 ) ] ) ];

		expect( shape( removeItem( blocks, page( 2 ) ) ) ).toEqual( [
			1, 3, 4,
		] );
	} );

	test( 'turns a submenu back into a link when its last item goes', () => {
		const blocks = [ link( 1, [ link( 2 ) ] ) ];
		const next = removeItem( blocks, page( 2 ) );

		expect( next[ 0 ].name ).toBe( 'core/navigation-link' );
	} );
} );

describe( 'addItem', () => {
	test( 'adds at the end, or at the end of a dropdown', () => {
		const blocks = [ link( 1 ), link( 2 ) ];

		expect( shape( addItem( blocks, link( 3 ) ) ) ).toEqual( [ 1, 2, 3 ] );

		const nested = addItem( blocks, link( 3 ), page( 1 ) );

		expect( shape( nested ) ).toEqual( [ { 1: [ 3 ] }, 2 ] );
		expect( nested[ 0 ].name ).toBe( 'core/navigation-submenu' );
	} );
} );

describe( 'moving items', () => {
	const blocks = [
		link( 1 ),
		link( 2, [ link( 3 ), link( 4 ) ] ),
		link( 5 ),
	];

	test( 'moves among the items beside it', () => {
		expect( shape( moveItem( blocks, page( 5 ), -1 ) ) ).toEqual( [
			1,
			5,
			{ 2: [ 3, 4 ] },
		] );
		expect( shape( moveItem( blocks, page( 3 ), 1 ) ) ).toEqual( [
			1,
			{ 2: [ 4, 3 ] },
			5,
		] );
		expect( moveItem( blocks, page( 1 ), -1 ) ).toEqual( blocks );
	} );

	test( 'goes into the dropdown above, and back out after it', () => {
		const indented = indentItem( blocks, page( 5 ) );

		expect( shape( indented ) ).toEqual( [ 1, { 2: [ 3, 4, 5 ] } ] );
		expect( shape( outdentItem( indented, page( 3 ) ) ) ).toEqual( [
			1,
			{ 2: [ 4, 5 ] },
			3,
		] );
		expect( shape( indentItem( blocks, page( 2 ) ) ) ).toEqual( [
			{ 1: [ { 2: [ 3, 4 ] } ] },
			5,
		] );
	} );

	test( 'says where an item is', () => {
		const place = getItemPlace( blocks, page( 4 ) );

		expect( place.depth ).toBe( 1 );
		expect( place.parent.attributes.id ).toBe( 2 );
		expect( place.previous.attributes.id ).toBe( 3 );
		expect( place.next ).toBeNull();
		expect( getItemPlace( blocks, page( 9 ) ) ).toBeNull();
	} );
} );
