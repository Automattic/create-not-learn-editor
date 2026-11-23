/**
 * External dependencies
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * WordPress dependencies
 */
import { addAction, removeAction } from '@wordpress/hooks';

/**
 * Internal dependencies
 */
import { appendFormValue, beat } from '../post-heartbeat';

describe( 'appendFormValue', () => {
	it( 'writes nested data in PHP’s bracket notation', () => {
		const params = new URLSearchParams();

		appendFormValue( params, 'data', {
			'wp-refresh-post-lock': { lock: '123:1', post_id: 52 },
			skipped: undefined,
		} );

		expect( [ ...params ] ).toEqual( [
			[ 'data[wp-refresh-post-lock][lock]', '123:1' ],
			[ 'data[wp-refresh-post-lock][post_id]', '52' ],
		] );
	} );
} );

describe( 'beat', () => {
	afterEach( () => {
		removeAction( 'heartbeat.send', 'test' );
		removeAction( 'heartbeat.tick', 'test' );
	} );

	it( 'sends what heartbeat.send adds, and hands the answer to heartbeat.tick', async () => {
		const answer = { 'wp-refresh-post-lock': { new_lock: '124:1' } };
		const fetch = vi
			.spyOn( window, 'fetch' )
			.mockResolvedValue( { ok: true, json: async () => answer } );
		const onTick = vi.fn();

		addAction( 'heartbeat.send', 'test', ( data ) => {
			data[ 'wp-refresh-post-lock' ] = { lock: '123:1', post_id: 52 };
		} );
		addAction( 'heartbeat.tick', 'test', onTick );

		await beat( { ajaxUrl: '/wp-admin/admin-ajax.php', nonce: 'abc' } );

		const [ url, { body } ] = fetch.mock.calls[ 0 ];
		expect( url ).toBe( '/wp-admin/admin-ajax.php' );
		expect( body.get( 'action' ) ).toBe( 'heartbeat' );
		expect( body.get( '_nonce' ) ).toBe( 'abc' );
		expect( body.get( 'data[wp-refresh-post-lock][post_id]' ) ).toBe(
			'52'
		);
		expect( onTick ).toHaveBeenCalledWith( answer, 'success' );
	} );

	it( 'doesn’t tick on an expired nonce', async () => {
		vi.spyOn( window, 'fetch' ).mockResolvedValue( {
			ok: true,
			json: async () => ( { nonces_expired: true } ),
		} );
		const onTick = vi.fn();
		addAction( 'heartbeat.tick', 'test', onTick );

		const answer = await beat( { ajaxUrl: '/a', nonce: 'old' } );

		expect( answer.nonces_expired ).toBe( true );
		expect( onTick ).not.toHaveBeenCalled();
	} );
} );
