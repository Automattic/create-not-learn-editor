/**
 * External dependencies
 */
import { describe, expect, test } from 'vitest';

/**
 * Internal dependencies
 */
import {
	getDropIndex,
	getSectionKind,
	getSectionSummary,
	getSectionTitle,
	groupSections,
} from '../page-sections';

const heading = ( content ) => ( {
	attributes: { content },
	innerBlocks: [],
	name: 'core/heading',
} );
const button = { attributes: {}, innerBlocks: [], name: 'core/button' };
const image = { attributes: {}, innerBlocks: [], name: 'core/image' };
const column = ( ...innerBlocks ) => ( {
	attributes: {},
	innerBlocks,
	name: 'core/column',
} );

describe( 'page sections', () => {
	test( 'names a section after its given name, then its first heading', () => {
		const group = {
			attributes: {},
			innerBlocks: [ heading( 'Welcome <em>home</em> &amp; stay' ) ],
			name: 'core/group',
		};

		expect( getSectionTitle( group ) ).toBe( 'Welcome home & stay' );
		expect(
			getSectionTitle( {
				...group,
				attributes: { metadata: { name: 'Hero' } },
			} )
		).toBe( 'Hero' );
	} );

	test( 'falls back to the first words of its text', () => {
		const text = {
			attributes: {},
			innerBlocks: [
				{
					attributes: {
						content:
							'Got questions? Feel free to reach out, we love hearing from you.',
					},
					innerBlocks: [],
					name: 'core/paragraph',
				},
			],
			name: 'core/group',
		};

		expect( getSectionTitle( text ) ).toBe(
			'Got questions? Feel free to reach out, we love…'
		);
		expect( getSectionSummary( text ) ).toBe( 'Section' );
	} );

	test( 'describes columns, calls to action and banners', () => {
		const columns = {
			attributes: {},
			innerBlocks: [
				{
					attributes: {},
					innerBlocks: [
						column( image ),
						column( image ),
						column( image ),
					],
					name: 'core/columns',
				},
			],
			name: 'core/group',
		};
		const cta = {
			attributes: {},
			innerBlocks: [
				heading( 'Join us' ),
				{
					attributes: {},
					innerBlocks: [ button, button ],
					name: 'core/buttons',
				},
			],
			name: 'core/group',
		};

		expect( getSectionKind( columns ) ).toBe( '3 columns' );
		expect( getSectionTitle( columns ) ).toBe( '3 columns' );
		expect( getSectionSummary( columns ) ).toBe( '3 images' );
		expect( getSectionKind( cta ) ).toBe( 'Call to action' );
		expect( getSectionSummary( cta ) ).toBe( 'Call to action · 2 buttons' );
	} );

	test( 'works out where a dropped section lands', () => {
		// Dragging the first item below the third.
		expect( getDropIndex( 0, 2, 'after' ) ).toBe( 2 );
		// Dragging the first item above the third.
		expect( getDropIndex( 0, 2, 'before' ) ).toBe( 1 );
		// Dragging the last item above the first.
		expect( getDropIndex( 3, 0, 'before' ) ).toBe( 0 );
		// Dropping an item next to itself leaves it in place.
		expect( getDropIndex( 1, 1, 'after' ) ).toBe( 1 );
		expect( getDropIndex( 1, 2, 'before' ) ).toBe( 1 );
	} );
} );

describe( 'groupSections', () => {
	const block = ( clientId, name ) => ( {
		attributes: {},
		clientId,
		innerBlocks: [],
		name,
	} );

	test( 'groups runs of text between containers', () => {
		const blocks = [
			block( 'a', 'core/heading' ),
			block( 'b', 'core/paragraph' ),
			block( 'c', 'core/cover' ),
			block( 'd', 'core/paragraph' ),
		];

		expect( groupSections( blocks ) ).toEqual( [
			{
				blocks: [ blocks[ 0 ], blocks[ 1 ] ],
				clientId: 'a',
				isText: true,
				start: 0,
			},
			{ blocks: [ blocks[ 2 ] ], clientId: 'c', isText: false, start: 2 },
			{ blocks: [ blocks[ 3 ] ], clientId: 'd', isText: true, start: 3 },
		] );
	} );
} );
