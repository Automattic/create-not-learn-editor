/**
 * External dependencies
 */
import { describe, expect, test } from 'vitest';

/**
 * Internal dependencies
 */
import { getPagePath } from '../page-path';

describe( 'getPagePath', () => {
	test( 'is the path after the domain, without a trailing slash', () => {
		expect(
			getPagePath( {
				permalink_template: 'https://example.com/%pagename%/',
				slug: 'about',
			} )
		).toBe( '/about' );
	} );

	test( 'includes the parent page for a page inside another', () => {
		expect(
			getPagePath( {
				permalink_template: 'https://example.com/about/%pagename%/',
				slug: 'team',
			} )
		).toBe( '/about/team' );
	} );

	test( 'uses the slug WordPress would give a draft without one', () => {
		expect(
			getPagePath( {
				generated_slug: 'opening-hours',
				permalink_template: 'https://example.com/%pagename%/',
				slug: '',
			} )
		).toBe( '/opening-hours' );
	} );

	test( 'keeps the query for plain permalinks', () => {
		expect(
			getPagePath( {
				link: 'https://example.com/?page_id=7',
				permalink_template: 'https://example.com/?page_id=7',
				slug: 'about',
			} )
		).toBe( '/?page_id=7' );
	} );

	test( 'is empty without a link', () => {
		expect( getPagePath( {} ) ).toBe( '' );
	} );
} );
