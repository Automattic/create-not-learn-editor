/**
 * Reading a section's content blocks.
 */
import { describe, expect, it } from 'vitest';

import { signature } from '../variants/from-content/content';

const b = ( name, attributes = {}, innerBlocks = [] ) => ( {
	name,
	attributes,
	innerBlocks,
} );
const group = ( ...inner ) =>
	b( 'core/group', { layout: { type: 'constrained' } }, inner );
const columns = ( ...cols ) =>
	b(
		'core/columns',
		{},
		cols.map( ( inner ) => b( 'core/column', {}, inner ) )
	);
const heading = ( content, level = 2, extra = {} ) =>
	b( 'core/heading', { content, level, ...extra } );
const para = ( content, extra = {} ) =>
	b( 'core/paragraph', { content, ...extra } );
const image = ( url, alt = '', id ) =>
	b( 'core/image', { url, alt, id, sizeSlug: 'large' } );
const buttons = ( ...inner ) => b( 'core/buttons', {}, inner );
const button = ( text, url ) => b( 'core/button', { text, url } );

describe( 'signature', () => {
	it( 'ignores groups, columns and button rows around the content', () => {
		const stacked = group(
			heading( 'A' ),
			para( 'B' ),
			buttons( button( 'Go' ) )
		);
		const split = group(
			columns(
				[ heading( 'A' ) ],
				[ para( 'B' ), buttons( button( 'Go' ) ) ]
			)
		);
		expect( signature( stacked ) ).toEqual( [
			'core/heading',
			'core/paragraph',
			'core/button',
		] );
		expect( signature( split ) ).toEqual( signature( stacked ) );
	} );

	it( 'keeps the order of the content', () => {
		expect( signature( group( heading( 'A' ), para( 'B' ) ) ) ).not.toEqual(
			signature( group( para( 'B' ), heading( 'A' ) ) )
		);
	} );

	it( 'counts every item, so three cards are not four', () => {
		const card = ( n ) => [ heading( `Card ${ n }`, 3 ), para( 'Text' ) ];
		const three = group( columns( card( 1 ), card( 2 ), card( 3 ) ) );
		const four = group(
			columns( card( 1 ), card( 2 ), card( 3 ), card( 4 ) )
		);
		expect( signature( three ) ).not.toEqual( signature( four ) );
	} );

	it( 'treats a cover or media & text picture as an image, then reads what is inside', () => {
		const cover = b(
			'core/cover',
			{ url: 'a.jpg', alt: 'A', dimRatio: 50 },
			[ heading( 'A' ) ]
		);
		const mediaText = b(
			'core/media-text',
			{ mediaUrl: 'a.jpg', mediaType: 'image' },
			[ heading( 'A' ) ]
		);
		const split = group(
			columns( [ image( 'a.jpg' ) ], [ heading( 'A' ) ] )
		);
		expect( signature( cover ) ).toEqual( [ 'image', 'core/heading' ] );
		expect( signature( mediaText ) ).toEqual( signature( split ) );
		expect( signature( cover ) ).toEqual( signature( split ) );
	} );

	it( 'treats a cover without a picture as a wrapper', () => {
		const plain = b(
			'core/cover',
			{ overlayColor: 'contrast', dimRatio: 100 },
			[ heading( 'A' ) ]
		);
		expect( signature( plain ) ).toEqual( [ 'core/heading' ] );
	} );

	it( 'ignores spacers and separators', () => {
		const spaced = group(
			heading( 'A' ),
			b( 'core/spacer', { height: '40px' } ),
			b( 'core/separator' ),
			para( 'B' )
		);
		expect( signature( spaced ) ).toEqual( [
			'core/heading',
			'core/paragraph',
		] );
	} );

	it( 'reads a list as one item, however many entries it has', () => {
		const list = ( n ) =>
			b(
				'core/list',
				{},
				Array.from( { length: n }, () =>
					b( 'core/list-item', { content: 'x' } )
				)
			);
		expect( signature( group( list( 2 ) ) ) ).toEqual( [ 'core/list' ] );
		expect( signature( group( list( 5 ) ) ) ).toEqual(
			signature( group( list( 2 ) ) )
		);
	} );
} );
