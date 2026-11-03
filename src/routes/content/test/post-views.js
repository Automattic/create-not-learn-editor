/**
 * External dependencies
 */
import { describe, expect, it } from 'vitest';

/**
 * Internal dependencies
 */
import { getPostView, getPostViewEmpty } from '../post-views';

describe( 'getPostView', () => {
	it( 'finds a tab by its slug', () => {
		expect( getPostView( 'drafts' ).statuses ).toEqual( [ 'draft' ] );
	} );

	it( 'falls back to "All" for an unknown slug', () => {
		expect( getPostView( 'default' ).slug ).toBe( 'all' );
		expect( getPostView( undefined ).slug ).toBe( 'all' );
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
