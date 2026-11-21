/**
 * External dependencies
 */
import { describe, expect, test, vi } from 'vitest';

vi.mock( '@wordpress/core-data', () => ( { store: 'core' } ) );
vi.mock( '@wordpress/data', () => ( {
	resolveSelect: vi.fn(),
	select: vi.fn(),
} ) );
vi.mock( '@wordpress/url', () => ( {
	addQueryArgs: ( url, args ) =>
		`${ url }?${ new URLSearchParams( args ).toString() }`,
} ) );

vi.mock( '../settings', () => {
	const postTypes = [
		{ name: 'page', blockEditor: true, coreEditor: null },
		{ name: 'post', blockEditor: true, coreEditor: 'meta-boxes' },
		{ name: 'book', blockEditor: false, coreEditor: 'classic' },
	];

	return {
		getEditablePostType: ( name ) =>
			postTypes.find( ( type ) => type.name === name ),
		settings: { adminUrl: 'http://example.test/wp-admin/', postTypes },
	};
} );

/**
 * Internal dependencies
 */
import {
	getCoreEditorNewUrl,
	getCoreEditorReason,
	getCoreEditorUrl,
	selectCoreEditorUrl,
} from '../core-editor';

const PAGE = { blockEditor: true, coreEditor: null };
const POST = { blockEditor: true, coreEditor: 'meta-boxes' };
const CLASSIC = { blockEditor: false, coreEditor: 'classic' };

describe( "falling back to core's editor", () => {
	test( 'follows the post type unless the post says otherwise', () => {
		expect( getCoreEditorReason( PAGE ) ).toBeNull();
		expect( getCoreEditorReason( POST ) ).toBe( 'meta-boxes' );
		expect(
			getCoreEditorReason( PAGE, { cnl_use_core_editor: true } )
		).toBe( 'meta-boxes' );
		expect(
			getCoreEditorReason( POST, { cnl_use_core_editor: false } )
		).toBeNull();
		expect(
			getCoreEditorReason( POST, { cnl_use_core_editor: null } )
		).toBe( 'meta-boxes' );
	} );

	test( 'a classic post type always opens in core', () => {
		expect(
			getCoreEditorReason( CLASSIC, { cnl_use_core_editor: false } )
		).toBe( 'classic' );
	} );

	test( "builds core's editor addresses", () => {
		expect( getCoreEditorUrl( 'post', 7 ) ).toBe(
			'http://example.test/wp-admin/post.php?post=7&action=edit&cnl-editor-opened=meta-boxes'
		);
		expect( getCoreEditorUrl( 'page', 7 ) ).toBeNull();
		expect( getCoreEditorNewUrl( 'book' ) ).toBe(
			'http://example.test/wp-admin/post-new.php?post_type=book&cnl-editor-opened=classic'
		);
		expect( getCoreEditorNewUrl( 'page' ) ).toBeNull();
	} );

	test( 'waits for the record, and leaves other types alone', () => {
		const store = {
			getEntityRecord: () => undefined,
			hasFinishedResolution: () => false,
		};
		const registrySelect = () => store;

		expect( selectCoreEditorUrl( registrySelect, 'page', 3 ) ).toBe(
			undefined
		);
		expect(
			selectCoreEditorUrl( registrySelect, 'wp_template', 3 )
		).toBeNull();
		expect( selectCoreEditorUrl( registrySelect, 'book', 3 ) ).toContain(
			'post.php?post=3'
		);
	} );
} );
