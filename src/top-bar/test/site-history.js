/**
 * External dependencies
 */
import { describe, expect, test, vi } from 'vitest';

vi.mock( '@wordpress/api-fetch', () => ( { default: vi.fn() } ) );
vi.mock( '@wordpress/core-data', () => ( { store: 'core' } ) );
vi.mock( '../../settings', () => ( { namespace: 'cnl/v1' } ) );

/**
 * Internal dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import {
	buildHistoryChanges,
	planRestore,
	restoreEntry,
} from '../site-history';

const styles = ( revision, previous ) => ( {
	kind: 'root',
	name: 'globalStyles',
	key: 7,
	label: 'Site look',
	revision,
	previous_revision: previous,
} );

const siteName = ( value, previous ) => ( {
	kind: 'root',
	name: 'site',
	label: 'Site name',
	values: { title: value },
	previous: { title: previous },
} );

describe( 'planRestore', () => {
	// Newest first, as the log is.
	const entries = [
		{ id: 'c', changes: [ siteName( 'Third', 'Second' ) ] },
		{
			id: 'b',
			changes: [ styles( 12, 11 ), siteName( 'Second', 'First' ) ],
		},
		{ id: 'a', changes: [ styles( 11, 10 ) ] },
	];

	test( 'the newest entry has nothing to put back', () => {
		expect( planRestore( entries, 0 ) ).toEqual( [] );
	} );

	test( 'undoes what later publishes changed, not the entry itself', () => {
		// Going back to "b" only undoes "c": the name goes back to Second.
		expect( planRestore( entries, 1 ) ).toEqual( [
			{
				kind: 'root',
				name: 'site',
				label: 'Site name',
				values: { title: 'Second' },
				missing: [],
			},
		] );
	} );

	test( 'puts each record back as it was before the oldest later change', () => {
		const plan = planRestore( entries, 2 );

		// The styles as "a" left them, revision 11, not "b"'s 12.
		expect( plan ).toContainEqual( {
			kind: 'root',
			name: 'globalStyles',
			key: 7,
			label: 'Site look',
			revision: 11,
		} );
		// The name as it was before "b", not before "c".
		expect( plan ).toContainEqual(
			expect.objectContaining( { values: { title: 'First' } } )
		);
	} );

	test( 'a record a later publish made has no revision to go back to', () => {
		const made = [
			{ id: 'b', changes: [ styles( 5, undefined ) ] },
			{ id: 'a', changes: [] },
		];

		expect( planRestore( made, 1 )[ 0 ].revision ).toBeNull();
	} );

	test( 'notes settings logged without what they were before', () => {
		const old = [
			{
				id: 'b',
				changes: [
					{
						kind: 'root',
						name: 'site',
						label: 'Site name',
						values: { title: 'New' },
					},
				],
			},
			{ id: 'a', changes: [] },
		];

		expect( planRestore( old, 1 )[ 0 ].missing ).toEqual( [ 'title' ] );
	} );
} );

describe( 'buildHistoryChanges', () => {
	test( 'keeps what site settings were before', () => {
		const [ change ] = buildHistoryChanges(
			[
				{
					kind: 'root',
					name: 'site',
					property: 'title',
					label: 'Name',
				},
			],
			{ title: 'New' },
			{ title: 'Old' }
		);

		expect( change.values ).toEqual( { title: 'New' } );
		expect( change.previous ).toEqual( { title: 'Old' } );
	} );
} );

describe( 'restoreEntry', () => {
	const header = {
		kind: 'postType',
		name: 'wp_template_part',
		key: 'theme//header',
		label: 'Header',
		revision: 3,
	};

	function makeRegistry() {
		const edits = {};
		const registry = {
			edits,
			select: () => ( {
				getEntityConfig: () => ( { baseURL: '/wp/v2/template-parts' } ),
				hasEditsForEntityRecord: ( kind, name, key ) => !! edits[ key ],
				getEntityRecordEdits: () => ( {} ),
			} ),
			resolveSelect: () => ( {
				getEntityRecord: async () => ( { origin: 'theme' } ),
			} ),
			dispatch: () => ( {
				editEntityRecord: ( kind, name, key, values ) => {
					edits[ key ] = values;
				},
			} ),
		};

		return registry;
	}

	test( 'a template a later publish first changed goes back to the theme file', async () => {
		apiFetch.mockResolvedValueOnce( {
			content: { raw: '<!-- theme header -->' },
		} );
		const registry = makeRegistry();
		const entries = [
			{ id: 'b', changes: [ header ] },
			{ id: 'a', changes: [] },
		];

		const result = await restoreEntry( entries, 1, registry );

		expect( apiFetch ).toHaveBeenLastCalledWith( {
			path: '/wp/v2/template-parts/theme//header?context=edit&source=theme',
		} );
		expect( registry.edits[ 'theme//header' ] ).toEqual( {
			content: '<!-- theme header -->',
		} );
		expect( result ).toEqual( { restored: 1, failed: 0 } );
	} );

	test( 'a template with an earlier version goes back to that revision', async () => {
		apiFetch.mockResolvedValueOnce( { content: { raw: 'before' } } );
		const registry = makeRegistry();
		const entries = [
			{ id: 'b', changes: [ { ...header, previous_revision: 2 } ] },
			{ id: 'a', changes: [] },
		];

		await restoreEntry( entries, 1, registry );

		expect( apiFetch ).toHaveBeenLastCalledWith( {
			path: '/wp/v2/template-parts/theme//header/revisions/2?context=edit',
		} );
	} );

	test( 'a menu a later publish made has nothing to go back to', async () => {
		const registry = makeRegistry();
		const entries = [
			{
				id: 'b',
				changes: [
					{
						kind: 'postType',
						name: 'wp_navigation',
						key: 9,
						revision: 4,
					},
				],
			},
			{ id: 'a', changes: [] },
		];

		expect( await restoreEntry( entries, 1, registry ) ).toEqual( {
			restored: 0,
			failed: 1,
		} );
	} );
} );
