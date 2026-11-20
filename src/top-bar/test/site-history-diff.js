/**
 * External dependencies
 */
import { describe, expect, test, vi } from 'vitest';

vi.mock( '@wordpress/blocks', () => ( { getBlockType: () => undefined } ) );
// The registry is faked below, so the store is only a name.
vi.mock( '@wordpress/core-data', () => ( { store: 'core' } ) );

/**
 * Internal dependencies
 */
import {
	describeChangeDetails,
	describePath,
	summarise,
} from '../site-history-diff';

function makeRegistry( { saved, edited, base = {} } ) {
	return {
		select: () => ( {
			getRawEntityRecord: () => saved,
			getEditedEntityRecord: () => edited,
			getEntityRecord: () => undefined,
			__experimentalGetCurrentThemeBaseGlobalStyles: () => base,
		} ),
	};
}

describe( 'describePath', () => {
	test( 'reads a style path in the editor’s words', () => {
		expect( describePath( [ 'styles', 'color', 'background' ] ) ).toBe(
			'Background color'
		);
		expect(
			describePath( [ 'styles', 'elements', 'link', 'color', 'text' ] )
		).toBe( 'Links › Text color' );
	} );
} );

describe( 'describeChangeDetails', () => {
	test( 'site look: names presets, and keeps from and to colours', () => {
		const base = {
			settings: {
				color: {
					palette: {
						theme: [
							{ slug: 'base', name: 'Base', color: '#ffffff' },
							{
								slug: 'contrast',
								name: 'Contrast',
								color: '#000000',
							},
						],
					},
				},
			},
		};
		const { details, summary } = describeChangeDetails(
			{ kind: 'root', name: 'globalStyles', key: 1 },
			makeRegistry( {
				base,
				saved: {
					styles: { color: { background: 'var:preset|color|base' } },
				},
				edited: {
					styles: {
						color: {
							background: 'var:preset|color|contrast',
							text: '#ff0000',
						},
					},
				},
			} )
		);

		expect( details ).toEqual( [
			{
				label: 'Background color',
				kind: 'changed',
				from: { text: 'Base', color: '#ffffff' },
				to: { text: 'Contrast', color: '#000000' },
			},
			{
				label: 'Text color',
				kind: 'changed',
				from: { text: 'Default' },
				to: { text: '#ff0000', color: '#ff0000' },
			},
		] );
		expect( summary ).toBe( 'Background color, Text color' );
	} );

	test( 'site settings: from and to', () => {
		const { details, summary } = describeChangeDetails(
			{ kind: 'root', name: 'site', property: 'title' },
			makeRegistry( {
				saved: { title: 'Old' },
				edited: { title: 'New' },
			} )
		);

		expect( details[ 0 ] ).toMatchObject( {
			from: { text: 'Old' },
			to: { text: 'New' },
		} );
		expect( summary ).toBe( 'Site name: Old → New' );
	} );

	test( 'blocks: text changed, block added and removed', () => {
		const { details, summary } = describeChangeDetails(
			{
				kind: 'postType',
				name: 'wp_template_part',
				key: 'theme//header',
			},
			makeRegistry( {
				saved: {
					content:
						'<!-- wp:heading --><h2>Hello</h2><!-- /wp:heading --><!-- wp:separator /-->',
				},
				edited: {
					content: () =>
						'<!-- wp:heading --><h2>Hi there</h2><!-- /wp:heading --><!-- wp:paragraph --><p>New</p><!-- /wp:paragraph -->',
				},
			} )
		);

		expect( details.map( ( { kind } ) => kind ).sort() ).toEqual( [
			'added',
			'changed',
			'removed',
		] );
		expect(
			details.find( ( { kind } ) => kind === 'changed' )
		).toMatchObject( {
			from: { text: 'Hello' },
			to: { text: 'Hi there' },
		} );
		expect( summary ).toBe( '1 edit, 1 block added, 1 block removed' );
	} );

	test( 'a block’s colour attribute names its palette colour', () => {
		const { details } = describeChangeDetails(
			{ kind: 'postType', name: 'wp_template_part', key: 1 },
			makeRegistry( {
				base: {
					settings: {
						color: {
							palette: [
								{
									slug: 'accent',
									name: 'Accent',
									color: '#f00',
								},
							],
						},
					},
				},
				saved: { content: '<!-- wp:group /-->' },
				edited: {
					content: '<!-- wp:group {"backgroundColor":"accent"} /-->',
				},
			} )
		);

		expect( details ).toEqual( [
			{
				label: 'Group › Background color',
				kind: 'changed',
				from: { text: 'Default' },
				to: { text: 'Accent', color: '#f00' },
			},
		] );
	} );
} );

describe( 'summarise', () => {
	test( 'names the first changes and counts the rest', () => {
		const details = [ 'A', 'B', 'C', 'D', 'E' ].map( ( label ) => ( {
			label: `Colors › ${ label }`,
			kind: 'changed',
		} ) );

		expect( summarise( details, false ) ).toBe( 'A, B and 3 more' );
	} );
} );
