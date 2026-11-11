/**
 * External dependencies
 */
import { describe, expect, it } from 'vitest';

/**
 * Internal dependencies
 */
import { withChange, withTask } from '../connection';

const MINUTE = 60 * 1000;
const change = ( text, time ) => ( { clientId: null, text, time } );

describe( 'agent change batches', () => {
	it( 'starts a batch for the first change', () => {
		const batches = withChange( [], change( 'Added a block', 0 ) );

		expect( batches ).toHaveLength( 1 );
		expect( batches[ 0 ].title ).toBeNull();
		expect( batches[ 0 ].changes.map( ( item ) => item.text ) ).toEqual( [
			'Added a block',
		] );
	} );

	it( 'keeps changes close together in one unnamed batch', () => {
		let batches = withChange( [], change( 'One', 0 ) );
		batches = withChange( batches, change( 'Two', MINUTE ) );

		expect( batches ).toHaveLength( 1 );
		expect( batches[ 0 ].changes ).toHaveLength( 2 );
		expect( batches[ 0 ].updatedAt ).toBe( MINUTE );
	} );

	it( 'starts another unnamed batch after a pause', () => {
		let batches = withChange( [], change( 'One', 0 ) );
		batches = withChange( batches, change( 'Two', 3 * MINUTE ) );

		expect( batches ).toHaveLength( 2 );
		expect( batches[ 0 ].changes[ 0 ].text ).toBe( 'Two' );
	} );

	it( 'keeps a named batch going however long the agent takes', () => {
		let batches = withTask( [], 'Autumn homepage', 0 );
		batches = withChange( batches, change( 'One', 10 * MINUTE ) );
		batches = withChange( batches, change( 'Two', 30 * MINUTE ) );

		expect( batches ).toHaveLength( 1 );
		expect( batches[ 0 ].title ).toBe( 'Autumn homepage' );
		expect( batches[ 0 ].changes ).toHaveLength( 2 );
	} );

	it( 'starts a new batch for each request', () => {
		let batches = withTask( [], 'Autumn homepage', 0 );
		batches = withChange( batches, change( 'One', MINUTE ) );
		batches = withTask( batches, 'Shorter footer', 2 * MINUTE );
		batches = withChange( batches, change( 'Two', 2 * MINUTE ) );

		expect( batches.map( ( batch ) => batch.title ) ).toEqual( [
			'Shorter footer',
			'Autumn homepage',
		] );
	} );

	it( 'renames a request that has no changes yet', () => {
		let batches = withTask( [], 'Autumn', 0 );
		batches = withTask( batches, 'Autumn homepage', MINUTE );

		expect( batches ).toHaveLength( 1 );
		expect( batches[ 0 ].title ).toBe( 'Autumn homepage' );
	} );
} );
