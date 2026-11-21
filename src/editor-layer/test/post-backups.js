/**
 * External dependencies
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';

/**
 * Internal dependencies
 */
import {
	discardPostBackups,
	getLocalBackupKey,
	isPostId,
} from '../post-backups';

vi.mock( '@wordpress/api-fetch', () => ( {
	default: vi.fn( () => Promise.resolve( { deleted: true } ) ),
} ) );

describe( 'isPostId', () => {
	it( 'takes posts’ IDs, not templates’', () => {
		expect( isPostId( 12 ) ).toBe( true );
		expect( isPostId( '12' ) ).toBe( true );
		expect( isPostId( 'mainstay//header' ) ).toBe( false );
		expect( isPostId( 0 ) ).toBe( false );
		expect( isPostId( undefined ) ).toBe( false );
	} );
} );

describe( 'discardPostBackups', () => {
	beforeEach( () => {
		window.sessionStorage.clear();
		apiFetch.mockClear();
	} );

	it( 'throws away a published post’s backup and autosave', () => {
		window.sessionStorage.setItem( getLocalBackupKey( 12 ), '{}' );
		window.sessionStorage.setItem( getLocalBackupKey( 13 ), '{}' );

		discardPostBackups( {
			postId: 12,
			postType: 'page',
			status: 'publish',
		} );

		expect(
			window.sessionStorage.getItem( getLocalBackupKey( 12 ) )
		).toBeNull();
		// Another post's is left alone.
		expect( window.sessionStorage.getItem( getLocalBackupKey( 13 ) ) ).toBe(
			'{}'
		);
		expect( apiFetch ).toHaveBeenCalledWith( {
			method: 'DELETE',
			path: '/create-not-learn-editor/v1/autosave/12',
		} );
	} );

	it( 'leaves the server alone for a draft, whose autosave is the draft', () => {
		window.sessionStorage.setItem( getLocalBackupKey( 12 ), '{}' );

		discardPostBackups( { postId: 12, postType: 'post', status: 'draft' } );

		expect(
			window.sessionStorage.getItem( getLocalBackupKey( 12 ) )
		).toBeNull();
		expect( apiFetch ).not.toHaveBeenCalled();
	} );

	it( 'clears the shared key of a post not saved yet', () => {
		window.sessionStorage.setItem( getLocalBackupKey( 12, true ), '{}' );

		discardPostBackups( {
			postId: 12,
			postType: 'post',
			status: 'auto-draft',
		} );

		expect(
			window.sessionStorage.getItem( getLocalBackupKey( 12, true ) )
		).toBeNull();
	} );

	it( 'does nothing for a template', () => {
		discardPostBackups( {
			postId: 'mainstay//single',
			postType: 'wp_template',
			status: 'publish',
		} );

		expect( apiFetch ).not.toHaveBeenCalled();
	} );
} );
