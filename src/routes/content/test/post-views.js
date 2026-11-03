/**
 * External dependencies
 */
import { describe, expect, it } from 'vitest';

/**
 * Internal dependencies
 */
import {
	getPostView,
	getPostViewEmpty,
	getPostViewFilters,
	getPostViewStatuses,
} from '../post-views';

describe( 'getPostView', () => {
	it( 'finds a tab by its slug', () => {
		expect( getPostView( 'drafts' ).statuses ).toEqual( [ 'draft' ] );
	} );

	it( 'falls back to "All" for an unknown slug', () => {
		expect( getPostView( 'default' ).slug ).toBe( 'all' );
		expect( getPostView( undefined ).slug ).toBe( 'all' );
	} );
} );

describe( 'getPostViewFilters', () => {
	it( 'locks a tab to its status', () => {
		expect( getPostViewFilters( getPostView( 'trash' ) ) ).toEqual( [
			{
				field: 'status',
				isLocked: true,
				operator: 'isAny',
				value: [ 'trash' ],
			},
		] );
	} );

	it( 'leaves "All" unfiltered', () => {
		expect( getPostViewFilters( getPostView( 'all' ) ) ).toEqual( [] );
	} );
} );

describe( 'getPostViewStatuses', () => {
	it( 'asks for the tab’s statuses', () => {
		expect( getPostViewStatuses( getPostView( 'future' ) ) ).toEqual( [
			'future',
		] );
	} );

	it( 'narrows "All" to a status filter picked there', () => {
		expect(
			getPostViewStatuses( getPostView( 'all' ), [
				{ field: 'status', operator: 'isAny', value: [ 'draft' ] },
			] )
		).toEqual( [ 'draft' ] );
	} );

	it( 'ignores an empty status filter', () => {
		expect(
			getPostViewStatuses( getPostView( 'all' ), [
				{ field: 'status', operator: 'isAny', value: [] },
			] )
		).toEqual( getPostView( 'all' ).statuses );
	} );
} );

describe( 'getPostViewEmpty', () => {
	it( 'says what each empty tab would hold', () => {
		const titles = [
			'all',
			'published',
			'future',
			'drafts',
			'pending',
			'private',
			'trash',
		].map( ( slug ) => getPostViewEmpty( getPostView( slug ) ).title );

		expect( new Set( titles ).size ).toBe( titles.length );
	} );

	it( 'offers to write a post only where writing one would fill it', () => {
		expect( getPostViewEmpty( getPostView( 'drafts' ) ).canWrite ).toBe(
			true
		);
		expect( getPostViewEmpty( getPostView( 'future' ) ).canWrite ).toBe(
			false
		);
		expect( getPostViewEmpty( getPostView( 'trash' ) ).canWrite ).toBe(
			false
		);
	} );

	it( 'says when a search finds nothing, rather than that the tab is empty', () => {
		const empty = getPostViewEmpty( getPostView( 'drafts' ), 'tulips' );

		expect( empty.title ).toContain( 'tulips' );
		expect( empty.canWrite ).toBe( false );
	} );
} );
