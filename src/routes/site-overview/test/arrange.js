/**
 * External dependencies
 */
import { describe, expect, test } from 'vitest';

/**
 * Internal dependencies
 */
import { buildPageTree } from '../../content/pages/page-tree';
import {
	applyPageTree,
	canDropOnPage,
	getDropChanges,
	getDropPosition,
} from '../arrange';

// About (1) with Team (2) under it, then Contact (3).
const PAGES = [
	{ id: 1, menu_order: 0, parent: 0, title: 'About' },
	{ id: 2, menu_order: 0, parent: 1, title: 'Team' },
	{ id: 3, menu_order: 1, parent: 0, title: 'Contact' },
];
const TREE = buildPageTree( PAGES );

// The top level's page IDs, in order, once some changes are made.
function getTopLevel( changes ) {
	return buildPageTree(
		PAGES.map( ( page ) => ( {
			...page,
			...changes.find( ( change ) => change.id === page.id ),
		} ) )
	).map( ( item ) => item.page.id );
}

describe( 'getDropPosition', () => {
	test( 'puts a page beside a card near its edges, and under it in the middle', () => {
		expect( getDropPosition( 0.1 ) ).toBe( 'before' );
		expect( getDropPosition( 0.5 ) ).toBe( 'under' );
		expect( getDropPosition( 0.9 ) ).toBe( 'after' );
	} );
} );

describe( 'canDropOnPage', () => {
	test( 'refuses a page on itself or on a page under it', () => {
		expect( canDropOnPage( TREE, 1, 1 ) ).toBe( false );
		expect( canDropOnPage( TREE, 1, 2 ) ).toBe( false );
		expect( canDropOnPage( TREE, 3, 2 ) ).toBe( true );
	} );
} );

describe( 'getDropChanges', () => {
	test( 'puts a page under another, after the pages already there', () => {
		expect(
			getDropChanges( TREE, 3, { position: 'under', targetId: 1 } )
		).toEqual( [ { id: 3, menu_order: 1, parent: 1 } ] );
	} );

	test( 'puts a page before another, among its siblings', () => {
		expect(
			getTopLevel(
				getDropChanges( TREE, 3, { position: 'before', targetId: 1 } )
			)
		).toEqual( [ 3, 1 ] );
	} );

	test( 'moves a sub-page to the top level, at the end', () => {
		expect(
			getTopLevel( getDropChanges( TREE, 2, { position: 'top' } ) )
		).toEqual( [ 1, 3, 2 ] );
	} );

	test( 'does nothing for a drop it refuses', () => {
		expect(
			getDropChanges( TREE, 1, { position: 'under', targetId: 2 } )
		).toEqual( [] );
	} );
} );

describe( 'applyPageTree', () => {
	test( 'draws pages where their unsaved moves put them', () => {
		const overview = {
			edges: [
				{ from: 'home', kind: 'child', to: 'page-1' },
				{ from: 'home', kind: 'child', to: 'page-3' },
				{ from: 'page-1', kind: 'child', to: 'page-2' },
			],
			nodes: [
				{ id: 'home', kind: 'home' },
				{ id: 'page-1', kind: 'page' },
				{ id: 'page-2', kind: 'page' },
				{ id: 'page-3', kind: 'page' },
			],
		};
		// Contact moved under About, before Team.
		const moved = buildPageTree( [
			{ id: 1, menu_order: 0, parent: 0 },
			{ id: 2, menu_order: 1, parent: 1 },
			{ id: 3, menu_order: 0, parent: 1 },
		] );
		const result = applyPageTree( overview, moved );

		expect( result.edges ).toEqual( [
			{ from: 'home', kind: 'child', to: 'page-1' },
			{ from: 'page-1', kind: 'child', to: 'page-3' },
			{ from: 'page-1', kind: 'child', to: 'page-2' },
		] );
		expect( result.nodes.map( ( node ) => node.id ) ).toEqual( [
			'home',
			'page-1',
			'page-3',
			'page-2',
		] );
	} );
} );
