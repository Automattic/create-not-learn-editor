/**
 * External dependencies
 */
import { describe, expect, it } from 'vitest';

/**
 * Internal dependencies
 */
import {
	getLayoutColumns,
	getLayoutGridColumns,
	MAX_LAYOUT_COLUMNS,
} from '../layout-grid';

describe( 'getLayoutGridColumns', () => {
	it( 'puts up to three in one row', () => {
		expect( getLayoutGridColumns( 2, 4 ) ).toBe( 2 );
		expect( getLayoutGridColumns( 3, 4 ) ).toBe( 3 );
	} );

	it( 'puts four two by two', () => {
		expect( getLayoutGridColumns( 4, 4 ) ).toBe( 2 );
	} );

	it( 'never leaves one on its own when a row of four avoids it', () => {
		expect( getLayoutGridColumns( 5, 4 ) ).toBe( 3 );
		expect( getLayoutGridColumns( 6, 4 ) ).toBe( 3 );
		expect( getLayoutGridColumns( 7, 4 ) ).toBe( 4 );
		expect( getLayoutGridColumns( 10, 4 ) ).toBe( 4 );
	} );

	it( 'keeps to the room there is', () => {
		expect( getLayoutGridColumns( 7, 2 ) ).toBe( 2 );
		expect( getLayoutGridColumns( 3, 1 ) ).toBe( 1 );
	} );
} );

describe( 'getLayoutColumns', () => {
	it( 'fits as many cards as the canvas has room for', () => {
		expect( getLayoutColumns( 2000 ) ).toBe( MAX_LAYOUT_COLUMNS );
		expect( getLayoutColumns( 450 ) ).toBe( 2 );
		expect( getLayoutColumns( 100 ) ).toBe( 1 );
	} );
} );
