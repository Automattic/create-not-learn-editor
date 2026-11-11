/**
 * External dependencies
 */
import { describe, expect, it } from 'vitest';

/**
 * Internal dependencies
 */
import { TOOLS } from '../declarations';

describe( 'TOOLS', () => {
	it( 'names every tool once, each starting cnl-', () => {
		const names = TOOLS.map( ( tool ) => tool.name );

		expect( new Set( names ).size ).toBe( names.length );
		names.forEach( ( name ) => expect( name ).toMatch( /^cnl-[a-z-]+$/ ) );
	} );

	it( 'describes each tool and its input as WebMCP expects', () => {
		TOOLS.forEach( ( tool ) => {
			expect( tool.description.length ).toBeGreaterThan( 40 );
			expect( tool.inputSchema.type ).toBe( 'object' );
			expect( typeof tool.annotations.readOnlyHint ).toBe( 'boolean' );
			( tool.inputSchema.required || [] ).forEach( ( key ) =>
				expect( tool.inputSchema.properties ).toHaveProperty( key )
			);
		} );
	} );

	it( 'marks only the reading tools as read-only', () => {
		const readOnly = TOOLS.filter(
			( tool ) => tool.annotations.readOnlyHint
		).map( ( tool ) => tool.name );

		expect( readOnly ).toEqual( [
			'cnl-list-pages',
			'cnl-open-page',
			'cnl-get-page',
			'cnl-get-designs',
			'cnl-get-site-style',
			'cnl-get-changes',
		] );
	} );
} );
