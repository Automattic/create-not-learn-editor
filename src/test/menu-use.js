/**
 * External dependencies
 */
import { describe, expect, it } from 'vitest';

/**
 * Internal dependencies
 */
import {
	HALF_LIFE_MS,
	getItemIdForRoute,
	getScore,
	pickShownItems,
	recordUse,
} from '../menu-use';

const NOW = 1_800_000_000_000;

const SITE = [
	{ id: 'site-overview' },
	{ id: 'navigation' },
	{ id: 'identity' },
	{ id: 'media' },
];

const visits = ( id, count, at = NOW ) =>
	Array.from( { length: count } ).reduce(
		( uses ) => recordUse( uses, id, at ),
		{}
	);

describe( 'getScore', () => {
	it( 'is nothing for an item never used', () => {
		expect( getScore( undefined, NOW ) ).toBe( 0 );
	} );

	it( 'halves every half-life', () => {
		const use = { score: 4, at: NOW };

		expect( getScore( use, NOW ) ).toBe( 4 );
		expect( getScore( use, NOW + HALF_LIFE_MS ) ).toBe( 2 );
		expect( getScore( use, NOW + 2 * HALF_LIFE_MS ) ).toBe( 1 );
	} );
} );

describe( 'recordUse', () => {
	it( 'adds a visit to the decayed score', () => {
		const uses = recordUse(
			{ media: { score: 2, at: NOW - HALF_LIFE_MS } },
			'media',
			NOW
		);

		expect( uses.media ).toEqual( { score: 2, at: NOW } );
	} );

	it( 'forgets scores that have decayed away', () => {
		const uses = recordUse(
			{ navigation: { score: 1, at: NOW - 3 * HALF_LIFE_MS } },
			'media',
			NOW
		);

		expect( uses ).not.toHaveProperty( 'navigation' );
	} );
} );

describe( 'pickShownItems', () => {
	// In the order listed, as the sidebar shows them.
	const pick = ( items, options ) => {
		const shown = pickShownItems( items, {
			limit: 3,
			uses: {},
			now: NOW,
			...options,
		} );

		return items
			.map( ( { id } ) => id )
			.filter( ( id ) => shown.has( id ) );
	};

	it( 'lists the defaults when nothing is used', () => {
		expect(
			pick( SITE, { defaults: [ 'site-overview', 'identity', 'media' ] } )
		).toEqual( [ 'site-overview', 'identity', 'media' ] );
	} );

	it( 'lists the first items when there are no defaults', () => {
		expect( pick( SITE ) ).toEqual( [
			'site-overview',
			'navigation',
			'identity',
		] );
	} );

	it( 'keeps the defaults after a single look elsewhere', () => {
		expect(
			pick( SITE, {
				defaults: [ 'site-overview', 'identity', 'media' ],
				uses: visits( 'navigation', 1 ),
			} )
		).not.toContain( 'navigation' );
	} );

	it( 'lists an item used often in place of the default used least', () => {
		const uses = {
			...visits( 'navigation', 4 ),
			...visits( 'identity', 1 ),
			...visits( 'media', 1 ),
		};

		expect(
			pick( SITE, {
				defaults: [ 'site-overview', 'identity', 'media' ],
				uses,
			} )
		).toEqual( [ 'navigation', 'identity', 'media' ] );
	} );

	it( 'keeps a default that is used as much as the item after its place', () => {
		const uses = {
			...visits( 'navigation', 2 ),
			...visits( 'site-overview', 0 ),
		};

		expect(
			pick( SITE, {
				defaults: [ 'site-overview', 'identity', 'media' ],
				uses,
			} )
		).toEqual( [ 'site-overview', 'identity', 'media' ] );
	} );

	it( 'lets old use fade', () => {
		expect(
			pick( SITE, {
				defaults: [ 'site-overview', 'identity', 'media' ],
				uses: visits( 'navigation', 5, NOW - 4 * HALF_LIFE_MS ),
			} )
		).not.toContain( 'navigation' );
	} );

	it( 'gives free places only to defaults and items in use', () => {
		const content = [
			{ id: 'pages' },
			{ id: 'content-post' },
			{ id: 'content-portfolio' },
		];
		const defaults = [ 'pages', 'content-post' ];

		expect( pick( content, { defaults } ) ).toEqual( [
			'pages',
			'content-post',
		] );
		expect(
			pick( content, {
				defaults,
				uses: visits( 'content-portfolio', 1 ),
			} )
		).toContain( 'content-portfolio' );
	} );

	it( 'always lists items marked always shown, in one of the places', () => {
		const content = [
			{ id: 'pages' },
			{ id: 'content-post' },
			{ id: 'content-product', alwaysShown: true },
			{ id: 'content-portfolio' },
		];

		expect(
			pick( content, {
				defaults: [ 'pages', 'content-post' ],
				uses: visits( 'content-portfolio', 10 ),
			} )
		).toEqual( [ 'pages', 'content-product', 'content-portfolio' ] );
	} );
} );

describe( 'getItemIdForRoute', () => {
	const items = [
		{ id: 'home', to: '/' },
		{ id: 'pages', to: '/types/page' },
		{ id: 'shop', to: '/shop' },
		{ id: 'content-product', to: '/shop/products' },
	];

	it( 'matches the screen and the screens under it', () => {
		expect( getItemIdForRoute( items, '/types/page' ) ).toBe( 'pages' );
		expect( getItemIdForRoute( items, '/types/page/edit/12' ) ).toBe(
			'pages'
		);
	} );

	it( 'picks the closest match', () => {
		expect( getItemIdForRoute( items, '/shop/products/3' ) ).toBe(
			'content-product'
		);
		expect( getItemIdForRoute( items, '/shop/orders' ) ).toBe( 'shop' );
	} );

	it( 'matches home only on itself', () => {
		expect( getItemIdForRoute( items, '/' ) ).toBe( 'home' );
		expect( getItemIdForRoute( items, '/media' ) ).toBe( null );
	} );

	it( 'does not match a route that only starts with the same letters', () => {
		expect( getItemIdForRoute( items, '/types/pages' ) ).toBe( null );
	} );
} );
