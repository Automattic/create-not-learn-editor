/**
 * External dependencies
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * WordPress dependencies
 */
import { dispatch, select } from '@wordpress/data';
import { store as preferencesStore } from '@wordpress/preferences';

/**
 * Internal dependencies
 */
import {
	PREFERENCE_NAME,
	PREFERENCES_SCOPE,
	getActiveWorkspace,
	mountWorkspaces,
} from '..';
import { settings } from '../../settings';

const EDITOR_URL = '/wp-admin/admin.php?page=create-not-learn-editor';

function openEditorAt( search ) {
	window.history.replaceState( null, '', `${ EDITOR_URL }${ search }` );
	mountWorkspaces();
}

beforeEach( () => {
	dispatch( preferencesStore ).set(
		PREFERENCES_SCOPE,
		PREFERENCE_NAME,
		undefined
	);
} );

afterEach( () => {
	delete settings.shop;
	window.history.replaceState( null, '', '/' );
} );

describe( 'mountWorkspaces', () => {
	it( 'switches to the workspace the address names, and keeps it', () => {
		openEditorAt( '&workspace=writing&p=%2Fpages' );

		expect( getActiveWorkspace().id ).toBe( 'writing' );
		expect(
			select( preferencesStore ).get( PREFERENCES_SCOPE, PREFERENCE_NAME )
		).toBe( 'writing' );
	} );

	it( 'takes the workspace out of the address, keeping the rest', () => {
		openEditorAt( '&workspace=builder&p=%2Fpages' );

		const url = new URL( window.location.href );
		expect( url.searchParams.has( 'workspace' ) ).toBe( false );
		expect( url.searchParams.get( 'page' ) ).toBe(
			'create-not-learn-editor'
		);
		expect( url.searchParams.get( 'p' ) ).toBe( '/pages' );
	} );

	it( 'saves a renamed workspace under its current id', () => {
		openEditorAt( '&workspace=blogging' );

		expect(
			select( preferencesStore ).get( PREFERENCES_SCOPE, PREFERENCE_NAME )
		).toBe( 'writing' );
	} );

	it( 'leaves the workspace alone for one the site can’t use', () => {
		dispatch( preferencesStore ).set(
			PREFERENCES_SCOPE,
			PREFERENCE_NAME,
			'builder'
		);

		openEditorAt( '&workspace=selling' );

		expect( getActiveWorkspace().id ).toBe( 'builder' );
		expect(
			new URL( window.location.href ).searchParams.has( 'workspace' )
		).toBe( false );
	} );

	it( 'opens Selling on a site with a shop', () => {
		settings.shop = {};

		openEditorAt( '&workspace=selling' );

		expect( getActiveWorkspace().id ).toBe( 'selling' );
	} );
} );
