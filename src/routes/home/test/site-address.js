/**
 * External dependencies
 */
import { describe, expect, test } from 'vitest';

/**
 * Internal dependencies
 */
import { getSiteAddress } from '../site-address';

describe( 'getSiteAddress', () => {
	test( 'shows the address the way people type it', () => {
		expect( getSiteAddress( 'https://www.fernhouse.com/' ) ).toBe(
			'fernhouse.com'
		);
		expect( getSiteAddress( 'http://fernhouse.blog' ) ).toBe(
			'fernhouse.blog'
		);
	} );

	test( 'keeps a site in a folder', () => {
		expect( getSiteAddress( 'https://example.com/bakery/' ) ).toBe(
			'example.com/bakery'
		);
	} );

	test( 'keeps a port on a real host', () => {
		expect( getSiteAddress( 'https://fernhouse.test:8443/' ) ).toBe(
			'fernhouse.test:8443'
		);
	} );

	test( 'shows a local address as it is', () => {
		expect( getSiteAddress( 'http://localhost:9581/' ) ).toBe(
			'localhost:9581'
		);
	} );

	test( 'leaves out Playground’s session folder', () => {
		expect(
			getSiteAddress( 'https://playground.wordpress.net/scope:0.123/' )
		).toBe( 'playground.wordpress.net' );
	} );

	test( 'has no address for a URL it can’t read', () => {
		expect( getSiteAddress( 'not a url' ) ).toBeNull();
	} );
} );
