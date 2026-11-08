/**
 * External dependencies
 */
import { afterEach, describe, expect, it } from 'vitest';

/**
 * Internal dependencies
 */
import {
	DEFAULT_WORKSPACE,
	WORKSPACES,
	findWorkspace,
	getAvailableWorkspaces,
	getWorkspace,
} from '../presets';
import { settings } from '../../settings';
import { getStartPlaces } from '../../start-places';

afterEach( () => {
	delete settings.shop;
} );

describe( 'getWorkspace', () => {
	it( 'finds a workspace by its id', () => {
		expect( getWorkspace( 'writing' ).id ).toBe( 'writing' );
	} );

	it( 'finds a renamed workspace by the id it was saved under', () => {
		expect( getWorkspace( 'blogging' ).id ).toBe( 'writing' );
	} );

	it( 'falls back to the default for an unknown id', () => {
		expect( getWorkspace( 'nope' ) ).toBe( DEFAULT_WORKSPACE );
		expect( getWorkspace( undefined ) ).toBe( DEFAULT_WORKSPACE );
	} );

	it( 'falls back to the default for a workspace the site can’t use', () => {
		expect( getWorkspace( 'selling' ) ).toBe( DEFAULT_WORKSPACE );

		settings.shop = {};

		expect( getWorkspace( 'selling' ).id ).toBe( 'selling' );
	} );
} );

describe( 'findWorkspace', () => {
	it( 'finds a workspace by its id or an id it was saved under', () => {
		expect( findWorkspace( 'builder' ).id ).toBe( 'builder' );
		expect( findWorkspace( 'blogging' ).id ).toBe( 'writing' );
	} );

	it( 'finds nothing for an unknown id or one the site can’t use', () => {
		expect( findWorkspace( 'nope' ) ).toBeUndefined();
		expect( findWorkspace( 'selling' ) ).toBeUndefined();
	} );
} );

describe( 'getAvailableWorkspaces', () => {
	it( 'offers Selling only on a site with a shop', () => {
		const ids = () => getAvailableWorkspaces().map( ( { id } ) => id );

		expect( ids() ).not.toContain( 'selling' );

		settings.shop = {};

		expect( ids() ).toContain( 'selling' );
	} );
} );

describe( 'WORKSPACES', () => {
	it( 'gives every workspace every setting', () => {
		WORKSPACES.forEach( ( workspace ) => {
			expect( workspace.home.places.length ).toBeGreaterThan( 0 );
			expect( workspace.home ).toHaveProperty( 'hint' );
			expect( Array.isArray( workspace.home.adminLinks ) ).toBe( true );
			expect( workspace.posts.layout ).toBeTruthy();
			expect( typeof workspace.writingAids ).toBe( 'boolean' );
		} );
	} );

	it( 'keeps settings a workspace leaves out at the default’s', () => {
		const builder = getWorkspace( 'builder' );

		expect( builder.home.preview ).toBe( DEFAULT_WORKSPACE.home.preview );
		expect( builder.home.viewLabel ).toBe(
			DEFAULT_WORKSPACE.home.viewLabel
		);
		expect( builder.posts ).toEqual( DEFAULT_WORKSPACE.posts );
	} );

	it( 'gives Builder no tip under its places', () => {
		expect( getWorkspace( 'builder' ).home.hint ).toBeNull();
	} );

	it( 'offers only places that exist on "Home"', () => {
		settings.shop = {};

		WORKSPACES.forEach( ( workspace ) => {
			expect( getStartPlaces( workspace.home ) ).toHaveLength(
				workspace.home.places.length
			);
		} );
	} );
} );

describe( 'getStartPlaces', () => {
	it( 'keeps the order it is given', () => {
		expect(
			getStartPlaces( { places: [ 'style', 'write' ] } ).map(
				( place ) => place.id
			)
		).toEqual( [ 'style', 'write' ] );
	} );

	it( 'rewords a place', () => {
		const [ place ] = getStartPlaces( {
			places: [ 'identity' ],
			copy: { identity: { description: 'Name your blog.' } },
		} );

		expect( place.description ).toBe( 'Name your blog.' );
		expect( place.title ).toBeTruthy();
	} );

	it( 'offers the shop only on a site with one', () => {
		const ids = () =>
			getStartPlaces( DEFAULT_WORKSPACE.home ).map( ( { id } ) => id );

		expect( ids() ).not.toContain( 'shop' );

		settings.shop = {};

		expect( ids() ).toContain( 'shop' );
		expect( getStartPlaces( getWorkspace( 'selling' ).home )[ 0 ].id ).toBe(
			'shop'
		);
	} );

	it( 'leaves out places it doesn’t know', () => {
		expect(
			getStartPlaces( { places: [ 'nope', 'write' ] } )
		).toHaveLength( 1 );
	} );
} );
