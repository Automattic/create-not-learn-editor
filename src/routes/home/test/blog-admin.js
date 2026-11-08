/**
 * External dependencies
 */
import { describe, expect, it } from 'vitest';

/**
 * Internal dependencies
 */
import { getBlogAdminLinks } from '../blog-admin-links';

const adminUrls = {
	comments: 'https://example.com/wp-admin/edit-comments.php',
	categories: 'https://example.com/wp-admin/edit-tags.php',
};

describe( 'getBlogAdminLinks', () => {
	it( 'keeps the order it is given', () => {
		expect(
			getBlogAdminLinks( [ 'categories', 'comments' ], {
				adminUrls,
			} ).map( ( { href } ) => href )
		).toEqual( [ adminUrls.categories, adminUrls.comments ] );
	} );

	it( 'leaves out links this person can’t use, or that don’t exist', () => {
		expect(
			getBlogAdminLinks( [ 'comments', 'nope' ], {
				adminUrls: { categories: adminUrls.categories },
			} )
		).toEqual( [] );
		expect( getBlogAdminLinks( [ 'categories' ] ) ).toEqual( [] );
	} );

	it( 'leads to the comments waiting for approval, and counts them', () => {
		const [ comments ] = getBlogAdminLinks(
			[ 'comments' ],
			{ adminUrls },
			3
		);

		expect( comments.href ).toBe(
			`${ adminUrls.comments }?comment_status=moderated`
		);
		expect( comments.description ).toContain( '3' );
	} );

	it( 'leads to every comment when none are waiting', () => {
		const [ comments ] = getBlogAdminLinks( [ 'comments' ], { adminUrls } );

		expect( comments.href ).toBe( adminUrls.comments );
	} );
} );
