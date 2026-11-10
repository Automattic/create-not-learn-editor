/**
 * External dependencies
 */
import { describe, expect, test } from 'vitest';

/**
 * Internal dependencies
 */
import {
	buildPageTree,
	countPageTree,
	filterPageTree,
	getPageAncestorTitles,
	getPageKeyboardTarget,
	getLevelChanges,
	getPageMoveChanges,
} from '../page-tree';

const getTitle = ( page ) => page.title;
const pages = [
	{ id: 1, menu_order: 2, parent: 0, title: 'Services' },
	{ id: 2, menu_order: 1, parent: 0, title: 'About' },
	{ id: 3, menu_order: 0, parent: 2, title: 'Team' },
	{ id: 4, menu_order: 0, parent: 1, title: 'Design' },
	{ id: 5, menu_order: 0, parent: 0, title: 'Home' },
	{ id: 6, menu_order: 0, parent: 99, title: 'Orphan' },
];

function titles( tree ) {
	return tree.map( ( node ) =>
		node.children.length
			? [ node.page.title, titles( node.children ) ]
			: node.page.title
	);
}

describe( 'page tree', () => {
	test( 'nests pages under parents and leads with the homepage', () => {
		const tree = buildPageTree( pages, { frontPageId: 5 } );

		expect( titles( tree ) ).toEqual( [
			'Home',
			'Orphan',
			[ 'About', [ 'Team' ] ],
			[ 'Services', [ 'Design' ] ],
		] );
		expect( countPageTree( tree ) ).toBe( 6 );
	} );

	test( 'does not loop on a page that is its own ancestor', () => {
		const tree = buildPageTree( [
			{ id: 1, parent: 2, title: 'A' },
			{ id: 2, parent: 1, title: 'B' },
			{ id: 3, parent: 3, title: 'C' },
		] );

		expect( titles( tree ) ).toEqual( [ 'C' ] );
	} );

	test( 'keeps matches and the parents leading to them', () => {
		const tree = filterPageTree( buildPageTree( pages ), 'des', getTitle );

		expect( titles( tree ) ).toEqual( [ [ 'Services', [ 'Design' ] ] ] );
	} );

	test( 'lists ancestor titles, nearest last', () => {
		const nested = [ ...pages, { id: 7, parent: 3, title: 'Leaders' } ];

		expect( getPageAncestorTitles( nested, 7, getTitle ) ).toEqual( [
			'About',
			'Team',
		] );
		expect( getPageAncestorTitles( nested, 2, getTitle ) ).toEqual( [] );
	} );

	describe( 'moving pages', () => {
		// Home, Orphan, About > [Team], Services > [Design]
		const tree = buildPageTree( pages, { frontPageId: 5 } );

		test( 'moves with the keyboard', () => {
			expect( getPageKeyboardTarget( tree, 5, 'ArrowUp' ) ).toBeNull();
			expect( getPageKeyboardTarget( tree, 6, 'ArrowUp' ) ).toEqual( {
				index: 0,
				parent: 0,
			} );
			expect( getPageKeyboardTarget( tree, 1, 'ArrowRight' ) ).toEqual( {
				index: 1,
				parent: 2,
			} );
			expect( getPageKeyboardTarget( tree, 4, 'ArrowLeft' ) ).toEqual( {
				index: 4,
				parent: 0,
			} );
			expect( getPageKeyboardTarget( tree, 5, 'ArrowLeft' ) ).toBeNull();
		} );

		test( 'changes only the moved page when it can', () => {
			// Design moves out of Services, to sit between About and Services.
			// Orphan, whose parent is gone, keeps it.
			expect(
				getPageMoveChanges(
					tree,
					4,
					{ index: 3, parent: 0 },
					{ frontPageId: 5 }
				)
			).toEqual( [ { id: 4, menu_order: 1, parent: 0 } ] );
		} );

		test( 'numbers a level afresh when one page can’t go in place', () => {
			const level = [ 'A', 'B', 'C', 'D' ].map( ( title, index ) => ( {
				id: index + 1,
				menu_order: 0,
				parent: 0,
				title,
			} ) );
			const wanted = [ 2, 4, 1, 3 ];
			const changes = getLevelChanges(
				wanted.map( ( id ) => level[ id - 1 ] ),
				0,
				{ previousIds: [ 1, 2, 3, 4 ] }
			);
			const saved = level.map( ( page ) => ( {
				...page,
				...changes.find( ( change ) => change.id === page.id ),
			} ) );

			expect(
				buildPageTree( saved ).map( ( node ) => node.page.id )
			).toEqual( wanted );
			expect( changes.length ).toBeGreaterThan( 1 );
		} );
	} );
} );
