/**
 * External dependencies
 */
import { afterEach, describe, expect, test, vi } from 'vitest';

vi.mock( '@wordpress/core-data', () => ( { store: 'core' } ) );
vi.mock( '@wordpress/data', () => ( { useSelect: vi.fn() } ) );

const workspace = { menusUntilSetByHand: true };
vi.mock( '../workspaces/presets', () => ( {
	getActiveWorkspace: () => workspace,
} ) );

const AUTO_MENU = '<!-- wp:page-list /-->';
const HAND_SET_MENU =
	'<!-- wp:page-list /--><!-- wp:navigation-link {"label":"Shop","url":"/shop/"} /-->';

/**
 * A registry `select` whose core store has these unsaved records.
 *
 * @param {Object[]} records Edited records, each with `name` and its edits.
 * @return {Function} The select.
 */
function getSelect( records = [] ) {
	const core = {
		__experimentalGetDirtyEntityRecords: () =>
			records.map( ( { name = 'wp_navigation' }, key ) => ( {
				key,
				kind: 'postType',
				name,
			} ) ),
		getEditedEntityRecord: ( kind, name, key ) => records[ key ],
	};

	return () => core;
}

/**
 * `areMenusShown`, fresh, as the editor loads it for a site that has or
 * hasn't a menu set by hand.
 *
 * @param {boolean} hasHandSetMenu What the server said.
 * @return {Promise<Function>} areMenusShown.
 */
async function load( hasHandSetMenu = false ) {
	vi.resetModules();
	window.createNotLearnEditor = { hasHandSetMenu };

	return ( await import( '../menus-shown' ) ).areMenusShown;
}

describe( 'areMenusShown', () => {
	afterEach( () => {
		workspace.menusUntilSetByHand = true;
		delete window.createNotLearnEditor;
	} );

	test( 'hides menus while every menu is an auto menu', async () => {
		const areMenusShown = await load();

		expect( areMenusShown( getSelect() ) ).toBe( false );
		expect( areMenusShown( getSelect( [ { content: AUTO_MENU } ] ) ) ).toBe(
			false
		);
		// The editor's lazy serializer, which isn't a menu set by hand.
		expect(
			areMenusShown( getSelect( [ { content: () => AUTO_MENU } ] ) )
		).toBe( false );
	} );

	test( 'shows menus when the server found one set by hand', async () => {
		const areMenusShown = await load( true );

		expect( areMenusShown( getSelect() ) ).toBe( true );
	} );

	test( 'always shows menus in a workspace that wants them', async () => {
		workspace.menusUntilSetByHand = false;
		const areMenusShown = await load();

		expect( areMenusShown( getSelect() ) ).toBe( true );
	} );

	test( 'shows menus once an unsaved menu is set by hand, and keeps them', async () => {
		const areMenusShown = await load();

		expect(
			areMenusShown(
				getSelect( [ { content: { raw: HAND_SET_MENU } } ] )
			)
		).toBe( true );
		// Saved, so nothing is unsaved to go by, but they stay.
		expect( areMenusShown( getSelect() ) ).toBe( true );
	} );

	test( 'reads every shape an edited menu comes in', async () => {
		const shapes = [
			{ content: HAND_SET_MENU },
			{ content: () => HAND_SET_MENU },
			{
				blocks: [
					{ name: 'core/page-list' },
					{ name: 'core/home-link' },
				],
			},
		];

		for ( const record of shapes ) {
			const areMenusShown = await load();

			expect( areMenusShown( getSelect( [ record ] ) ) ).toBe( true );
		}
	} );

	test( 'goes only by menus, not other unsaved records', async () => {
		const areMenusShown = await load();

		expect(
			areMenusShown(
				getSelect( [ { name: 'page', content: HAND_SET_MENU } ] )
			)
		).toBe( false );
	} );
} );
