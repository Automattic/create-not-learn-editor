/**
 * Generated layouts: the section's own content blocks in new layout blocks.
 * Whatever the layout, no content is added, removed or changed.
 */
import { describe, expect, it } from 'vitest';

import { arrangements } from '../variants/from-content';
import {
	b,
	group,
	heading,
	para,
	image,
	contentOf,
	SECTIONS,
	services,
	quotes,
	grid,
} from './helpers/from-content';

describe( 'arrangements', () => {
	it.each( Object.entries( SECTIONS ) )(
		'offers at least one layout for %s',
		( _, section ) => {
			expect( arrangements( section ).length ).toBeGreaterThan( 0 );
		}
	);

	it.each( Object.entries( SECTIONS ) )(
		'never adds, removes or changes content in %s',
		( _, section ) => {
			const before = contentOf( section );
			for ( const { key, block } of arrangements( section ) ) {
				expect( { key, content: contentOf( block ) } ).toEqual( {
					key,
					content: before,
				} );
			}
		}
	);

	it( 'does not change the blocks it was given', () => {
		for ( const section of Object.values( SECTIONS ) ) {
			const copy = JSON.parse( JSON.stringify( section ) );
			arrangements( section );
			expect( section ).toEqual( copy );
		}
	} );

	it( 'puts a picture behind the text when its caption is empty rich text', () => {
		// In the editor, an empty caption is a rich text object, not ''.
		const empty = { toString: () => '' };
		const section = group(
			heading( 'A' ),
			image( 'a.jpg', { caption: empty } )
		);
		expect( arrangements( section ).map( ( l ) => l.key ) ).toContain(
			'content:cover'
		);
	} );

	it( 'splits text into two columns under its first heading, not when there is a picture', () => {
		const keys = ( section ) =>
			arrangements( section ).map( ( l ) => l.key );
		expect( keys( SECTIONS[ 'text beside an image' ] ) ).not.toContain(
			'content:two-columns'
		);
		const layout = arrangements(
			group( para( 'Intro.' ), heading( 'Title' ), para( 'More.' ) )
		).find( ( l ) => l.key === 'content:two-columns' );
		expect( layout.block.innerBlocks.map( ( x ) => x.name ) ).toEqual( [
			'core/heading',
			'core/columns',
		] );
	} );
} );

describe( 'column counts', () => {
	const counts = ( section ) =>
		arrangements( section )
			.map( ( l ) => l.key )
			.filter( ( k ) => k.startsWith( 'content:columns-' ) );
	const layout = ( section, n ) =>
		arrangements( section ).find(
			( l ) => l.key === `content:columns-${ n }`
		);
	/**
	 * The rows of columns in a services section's layout.
	 *
	 * @param {Object} l A layout.
	 */
	const rows = ( l ) => l.block.innerBlocks.slice( 1 );
	const isEmptyColumn = ( x ) =>
		x.name === 'core/column' && ! x.innerBlocks.length;

	it( 'offers one fewer and one more column', () => {
		expect( counts( services( 3 ) ) ).toEqual( [
			'content:columns-2',
			'content:columns-4',
		] );
		expect( counts( services( 4 ) ) ).toEqual( [
			'content:columns-3',
			'content:columns-5',
		] );
		expect( counts( services( 2 ) ) ).toEqual( [
			'content:columns-1',
			'content:columns-3',
		] );
	} );

	it.each( Object.entries( SECTIONS ) )(
		'gives each layout for %s a name of its own',
		( _, section ) => {
			const labels = arrangements( section ).map( ( l ) =>
				l.label.toLowerCase().replace( 'two', '2' )
			);
			expect( new Set( labels ).size ).toBe( labels.length );
		}
	);

	it( 'never goes past six columns', () => {
		expect( counts( services( 6 ) ) ).toEqual( [ 'content:columns-5' ] );
	} );

	it( 'labels each layout by its number of columns', () => {
		expect( layout( services( 3 ), 4 ).label ).toBe( '4 columns' );
		expect( layout( services( 2 ), 1 ).label ).toBe( '1 column' );
	} );

	it( 'leaves out columns that are not alike', () => {
		expect( counts( SECTIONS[ 'text beside an image' ] ) ).toEqual( [] );
		expect( counts( SECTIONS[ 'a hand-built mix' ] ) ).toEqual( [] );
	} );

	it( 'wraps the cards into rows, filling the last with empty columns', () => {
		const two = rows( layout( services( 3 ), 2 ) );
		expect( two.map( ( r ) => r.innerBlocks.length ) ).toEqual( [ 2, 2 ] );
		expect( isEmptyColumn( two[ 1 ].innerBlocks[ 1 ] ) ).toBe( true );

		const four = rows( layout( services( 3 ), 4 ) );
		expect( four ).toHaveLength( 1 );
		expect( four[ 0 ].innerBlocks ).toHaveLength( 4 );
		expect( isEmptyColumn( four[ 0 ].innerBlocks[ 3 ] ) ).toBe( true );
	} );

	it( 'keeps the cards and the rows as the pattern styled them', () => {
		const section = services( 3 );
		const [ before ] = section.innerBlocks.slice( 1 );
		const [ first, second ] = rows( layout( section, 2 ) );
		for ( const row of [ first, second ] ) {
			expect( row.name ).toBe( 'core/columns' );
			expect( row.attributes ).toEqual( before.attributes );
		}
		// Each card is the same column, without a width meant for three.
		const { width, ...kept } = before.innerBlocks[ 0 ].attributes;
		expect( width ).toBe( '33.33%' );
		expect( first.innerBlocks[ 0 ] ).toEqual( {
			...before.innerBlocks[ 0 ],
			attributes: kept,
		} );
		expect( second.innerBlocks[ 0 ].innerBlocks ).toBe(
			before.innerBlocks[ 2 ].innerBlocks
		);
	} );

	it( 'keeps the rest of the section, but not as the pattern it came from', () => {
		const section = services( 3 );
		const { block } = layout( section, 4 );
		expect( block.name ).toBe( 'core/group' );
		expect( block.attributes ).toEqual( {
			align: 'full',
			metadata: { name: 'Services' },
			style: { color: { background: '#eee' } },
		} );
		expect( block.innerBlocks[ 0 ] ).toBe( section.innerBlocks[ 0 ] );
	} );

	it( 'treats rows of alike cards as one set', () => {
		const section = quotes();
		expect( counts( section ) ).toEqual( [
			'content:columns-2',
			'content:columns-4',
		] );
		const two = layout( section, 2 ).block.innerBlocks.slice( 1 );
		expect( two.map( ( r ) => r.innerBlocks.length ) ).toEqual( [
			2, 2, 2,
		] );
		expect( two.map( ( r ) => r.attributes.className ) ).toEqual( [
			'is-quotes',
			'is-quotes',
			'is-quotes',
		] );
		const four = layout( section, 4 ).block.innerBlocks.slice( 1 );
		expect( four.map( ( r ) => r.innerBlocks.length ) ).toEqual( [ 4, 4 ] );
		expect( four[ 1 ].innerBlocks.filter( isEmptyColumn ) ).toHaveLength(
			2
		);
	} );

	it( 'counts a row it filled with empty columns at its full width', () => {
		// After 3 cards went to 4 columns, the choice is 3 or 5.
		const wrapped = layout( services( 3 ), 4 ).block;
		expect( counts( wrapped ) ).toEqual( [
			'content:columns-3',
			'content:columns-5',
		] );
		const back = rows( layout( wrapped, 3 ) );
		expect( back ).toHaveLength( 1 );
		expect( back[ 0 ].innerBlocks.filter( isEmptyColumn ) ).toHaveLength(
			0
		);
	} );

	it( 'gives a grid its shapes instead', () => {
		expect( counts( grid( 2, 4 ) ) ).toEqual( [] );
	} );

	it( 'wraps rows in a group when the section is the columns', () => {
		const section = SECTIONS[ 'columns on their own' ];
		const one = layout( section, 4 ).block;
		expect( one.name ).toBe( 'core/columns' );
		expect( one.innerBlocks ).toHaveLength( 4 );
		const two = layout( section, 2 ).block;
		expect( two.name ).toBe( 'core/group' );
		expect( two.attributes ).toEqual( { align: 'wide' } );
		expect( two.innerBlocks.map( ( r ) => r.name ) ).toEqual( [
			'core/columns',
			'core/columns',
		] );
	} );
} );

describe( 'grid shapes', () => {
	const shapes = ( section ) =>
		arrangements( section )
			.filter( ( l ) => l.key.startsWith( 'content:grid-' ) )
			.map( ( l ) => [ l.key, l.label ] );
	const shape = ( section, key ) =>
		arrangements( section ).find( ( l ) => l.key === 'content:grid-' + key )
			.block;
	/**
	 * The grid in a layout of a section made by grid().
	 *
	 * @param {Object} block
	 */
	const gridOf = ( block ) => block.innerBlocks[ 0 ];
	const spanOf = ( cell ) => cell.attributes.style?.layout;

	it( 'offers every number across, a featured cell and a banner', () => {
		expect( shapes( grid( 2, 4 ) ) ).toEqual( [
			[ 'content:grid-1', '4 × 1 grid' ],
			[ 'content:grid-3', '2 × 3 grid' ],
			[ 'content:grid-4', '1 × 4 grid' ],
			[ 'content:grid-featured-3', 'Featured, 3 across' ],
			[ 'content:grid-banner-3', 'Banner, then 3 across' ],
		] );
	} );

	it( 'goes up to six across, with a featured cell in three or four', () => {
		// Eight cells, three across now; seven left for a banner fill no rows.
		expect( shapes( grid( 3, 8 ) ).map( ( [ key ] ) => key ) ).toEqual( [
			'content:grid-1',
			'content:grid-2',
			'content:grid-4',
			'content:grid-5',
			'content:grid-6',
			'content:grid-featured-3',
			'content:grid-featured-4',
		] );
	} );

	it( 'offers a banner only when the rest fill their rows', () => {
		const keys = ( section ) => shapes( section ).map( ( [ key ] ) => key );
		expect( keys( grid( 3, 7 ) ) ).toContain( 'content:grid-banner-2' );
		expect( keys( grid( 3, 7 ) ) ).toContain( 'content:grid-banner-3' );
		expect( keys( grid( 3, 7 ) ) ).toContain( 'content:grid-banner-6' );
		expect( keys( grid( 3, 6 ) ) ).toContain( 'content:grid-banner-5' );
		expect( keys( grid( 3, 6 ) ) ).not.toContain( 'content:grid-banner-2' );
	} );

	it( 'changes only the number across, keeping the cells', () => {
		const section = grid( 2, 4 );
		const before = gridOf( section );
		const after = gridOf( shape( section, '3' ) );
		expect( after.attributes ).toEqual( {
			layout: { type: 'grid', columnCount: 3 },
		} );
		expect( after.innerBlocks ).toEqual( before.innerBlocks );
	} );

	it( 'gives a grid that sizes its own columns a set number across, without a minimum width that would allow fewer', () => {
		const section = grid( undefined, 6, { minimumColumnWidth: '12rem' } );
		const keys = shapes( section ).map( ( [ key ] ) => key );
		expect( keys ).toContain( 'content:grid-2' );
		expect( keys ).toContain( 'content:grid-3' );
		expect( gridOf( shape( section, '3' ) ).attributes.layout ).toEqual( {
			type: 'grid',
			columnCount: 3,
		} );
	} );

	it( 'takes any cells, alike or not', () => {
		const section = group(
			b( 'core/group', { layout: { type: 'grid', columnCount: 4 } }, [
				group( heading( 'Shop' ) ),
				image( 'a.jpg' ),
				image( 'b.jpg' ),
				image( 'c.jpg' ),
			] )
		);
		expect( shapes( section ).length ).toBeGreaterThan( 0 );
	} );

	it( 'makes the first cell two by two when featured, as it was otherwise', () => {
		const section = grid( 2, 5 );
		const cells = gridOf( shape( section, 'featured-3' ) ).innerBlocks;
		expect(
			gridOf( shape( section, 'featured-3' ) ).attributes.layout
		).toEqual( { type: 'grid', columnCount: 3 } );
		expect( spanOf( cells[ 0 ] ) ).toEqual( { columnSpan: 2, rowSpan: 2 } );
		expect( cells[ 0 ].innerBlocks ).toBe(
			gridOf( section ).innerBlocks[ 0 ].innerBlocks
		);
		expect( cells.slice( 1 ).map( spanOf ) ).toEqual( [
			undefined,
			undefined,
			undefined,
			undefined,
		] );
	} );

	it( 'makes the first cell as wide as the grid for a banner', () => {
		const cells = gridOf( shape( grid( 2, 5 ), 'banner-4' ) ).innerBlocks;
		expect( spanOf( cells[ 0 ] ) ).toEqual( { columnSpan: 4 } );
	} );

	it( 'keeps the rest of a cell’s style when it spans', () => {
		const section = group(
			b( 'core/group', { layout: { type: 'grid', columnCount: 2 } }, [
				b( 'core/group', { style: { border: { radius: '8px' } } }, [
					para( 'One' ),
				] ),
				group( para( 'Two' ) ),
				group( para( 'Three' ) ),
			] )
		);
		const [ first ] = gridOf( shape( section, 'featured-3' ) ).innerBlocks;
		expect( first.attributes.style ).toEqual( {
			border: { radius: '8px' },
			layout: { columnSpan: 2, rowSpan: 2 },
		} );
	} );

	it( 'puts a content block that spans in a group, leaving the block as it was', () => {
		const pic = image( 'a.jpg' );
		const section = group(
			b( 'core/group', { layout: { type: 'grid', columnCount: 3 } }, [
				pic,
				image( 'b.jpg' ),
				image( 'c.jpg' ),
			] )
		);
		const [ first ] = gridOf( shape( section, 'banner-2' ) ).innerBlocks;
		expect( first.name ).toBe( 'core/group' );
		expect( spanOf( first ) ).toEqual( { columnSpan: 2 } );
		expect( first.innerBlocks ).toEqual( [ pic ] );
	} );

	it( 'takes away the spans of an earlier shape', () => {
		const featured = shape( grid( 2, 5 ), 'featured-3' );
		const plain = shape( featured, '5' );
		expect( gridOf( plain ).innerBlocks.map( spanOf ) ).toEqual( [
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
		] );
	} );

	it( 'does not offer the shape the grid already has', () => {
		const featured = shape( grid( 2, 5 ), 'featured-3' );
		const keys = shapes( featured ).map( ( [ key ] ) => key );
		expect( keys ).not.toContain( 'content:grid-featured-3' );
		expect( keys ).toContain( 'content:grid-3' );
	} );
} );
