/**
 * External dependencies
 */
import { describe, expect, it } from 'vitest';

/**
 * Internal dependencies
 */
import { findByName } from '../match';

const LOOKS = [ 'Theme default', 'Gallery', 'Garden party', 'Night owl' ];
const same = ( name ) => name;

describe( 'findByName', () => {
	it( 'finds a name without regard to case or spacing', () => {
		expect( findByName( LOOKS, '  night   OWL ', same, 'look' ) ).toBe(
			'Night owl'
		);
	} );

	it( 'prefers an exact match over a longer name starting the same', () => {
		expect(
			findByName( [ 'Soft', 'Soft tint' ], 'soft', same, 'colour' )
		).toBe( 'Soft' );
	} );

	it( 'takes the start, or part, of one name', () => {
		expect( findByName( LOOKS, 'night', same, 'look' ) ).toBe(
			'Night owl'
		);
		expect( findByName( LOOKS, 'party', same, 'look' ) ).toBe(
			'Garden party'
		);
	} );

	it( 'refuses a part that more than one name has, listing them all', () => {
		expect( () => findByName( LOOKS, 'ga', same, 'look' ) ).toThrow(
			'No look is called "ga". There are: Theme default, Gallery, Garden party, Night owl.'
		);
	} );

	it( 'refuses an empty name', () => {
		expect( () => findByName( LOOKS, '', same, 'look' ) ).toThrow(
			'No look is called ""'
		);
	} );

	it( 'reads names with the function given', () => {
		const pages = [
			{ id: 4, title: 'Home' },
			{ id: 5, title: 'About' },
		];

		expect(
			findByName( pages, 'about', ( page ) => page.title, 'page' )
		).toBe( pages[ 1 ] );
	} );
} );
