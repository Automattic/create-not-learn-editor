/**
 * External dependencies
 */
import { describe, expect, it } from 'vitest';

/**
 * Internal dependencies
 */
import { groupOverviewRows } from '../overview-groups';

const row = ( clientId, area = null ) => ( { area, clientId } );
const ids = ( rows ) => rows.map( ( { clientId } ) => clientId );

describe( 'groupOverviewRows', () => {
	it( 'puts the header and footer either side of the content', () => {
		const groups = groupOverviewRows( [
			row( 'header', 'header' ),
			row( 'title' ),
			row( 'hero' ),
			row( 'footer', 'footer' ),
		] );

		expect( ids( groups.header ) ).toEqual( [ 'header' ] );
		expect( ids( groups.content ) ).toEqual( [ 'title', 'hero' ] );
		expect( ids( groups.footer ) ).toEqual( [ 'footer' ] );
	} );

	it( 'keeps other parts, and headers or footers mid-page, in the content', () => {
		const groups = groupOverviewRows( [
			row( 'header', 'header' ),
			row( 'sidebar', 'uncategorized' ),
			row( 'hero' ),
			row( 'second-header', 'header' ),
			row( 'cta' ),
			row( 'footer', 'footer' ),
			row( 'legal', 'footer' ),
		] );

		expect( ids( groups.header ) ).toEqual( [ 'header' ] );
		expect( ids( groups.content ) ).toEqual( [
			'sidebar',
			'hero',
			'second-header',
			'cta',
		] );
		expect( ids( groups.footer ) ).toEqual( [ 'footer', 'legal' ] );
	} );

	it( 'leaves the content empty for a page of only parts', () => {
		const groups = groupOverviewRows( [
			row( 'header', 'header' ),
			row( 'footer', 'footer' ),
		] );

		expect( ids( groups.header ) ).toEqual( [ 'header' ] );
		expect( groups.content ).toEqual( [] );
		expect( ids( groups.footer ) ).toEqual( [ 'footer' ] );
	} );
} );
