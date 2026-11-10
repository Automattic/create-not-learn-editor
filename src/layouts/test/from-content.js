/**
 * Generated layouts: the section's own content blocks in new layout blocks.
 * Whatever the layout, no content is added, removed or changed.
 */
import { describe, expect, it } from 'vitest';

import { arrangements, WIDE } from '../variants/from-content';

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
const image = ( url, extra = {} ) =>
	b( 'core/image', { url, alt: `Alt ${ url }`, id: 7, ...extra } );
const buttons = ( ...inner ) => b( 'core/buttons', {}, inner );
const button = ( text, url ) => b( 'core/button', { text, url } );
const spacer = () => b( 'core/spacer', { height: '40px' } );

/** Blocks that only lay out others, which a layout may add or remove. */
const LAYOUT = [
	'core/group',
	'core/columns',
	'core/column',
	'core/buttons',
	'core/spacer',
	'core/separator',
];

/**
 * Everything in a section that is content, independent of the layout: each
 * picture (wherever it's shown), and every other content block whole, with
 * all its attributes and inner blocks.
 *
 * @param {Object} block
 * @return {string[]} One sorted entry per item of content.
 */
function contentOf( block ) {
	const items = [];
	const strip = ( x ) => ( {
		name: x.name,
		attributes: x.attributes,
		innerBlocks: ( x.innerBlocks || [] ).map( strip ),
	} );
	const walk = ( x ) => {
		const a = x.attributes || {};
		if ( LAYOUT.includes( x.name ) ) {
			x.innerBlocks.forEach( walk );
		} else if ( x.name === 'core/cover' ) {
			if ( a.url ) {
				items.push( { picture: [ a.url, a.alt, a.id ] } );
			}
			x.innerBlocks.forEach( walk );
		} else if ( x.name === 'core/media-text' ) {
			if ( a.mediaUrl ) {
				items.push( {
					picture: [ a.mediaUrl, a.mediaAlt, a.mediaId ],
				} );
			}
			x.innerBlocks.forEach( walk );
		} else if ( x.name === 'core/image' ) {
			items.push( { picture: [ a.url, a.alt, a.id ] } );
			// An image's caption and link are content too.
			if ( a.caption || a.href ) {
				items.push( { image: [ a.caption, a.href, a.linkTarget ] } );
			}
		} else {
			items.push( strip( x ) );
		}
	};
	walk( block );
	return items.map( ( i ) => JSON.stringify( i ) ).sort();
}

const SECTIONS = {
	'a cover hero': b(
		'core/cover',
		{ url: 'hero.jpg', alt: 'Hero', id: 1, dimRatio: 50 },
		[
			heading( 'Welcome', 1 ),
			para( 'A <strong>short</strong> intro.' ),
			buttons( button( 'Start', '/start' ) ),
		]
	),
	'text beside an image': group(
		columns(
			[ heading( 'About' ), para( 'Who we are.' ) ],
			[ image( 'about.jpg' ) ]
		)
	),
	'a media & text section': b(
		'core/media-text',
		{
			mediaUrl: 'side.jpg',
			mediaAlt: 'Side',
			mediaId: 3,
			mediaType: 'image',
		},
		[ heading( 'Side by side', 3 ), para( 'Text.' ) ]
	),
	'a call to action': group(
		spacer(),
		heading( 'Join us' ),
		para( 'It is free.' ),
		buttons( button( 'Sign up', '/join' ), button( 'Learn more', '/more' ) )
	),
	'text only': group(
		heading( 'Story' ),
		para( 'One.' ),
		para( 'Two.' ),
		para( 'Three.' )
	),
	'a quote': group(
		b( 'core/quote', { citation: 'Someone' }, [ para( 'Wise words.' ) ] ),
		para( 'After.' )
	),
	'a hand-built mix': group(
		heading( 'Menu', 2, { textAlign: 'center' } ),
		image( 'dish.jpg', { caption: 'Our dish', href: '/dish' } ),
		b( 'core/list', { ordered: true }, [
			b( 'core/list-item', { content: 'Soup' } ),
			b( 'core/list-item', { content: 'Bread' } ),
		] ),
		para( 'Open daily.' )
	),
	'two pictures': group(
		heading( 'Gallery' ),
		columns( [ image( 'a.jpg' ) ], [ image( 'b.jpg' ) ] )
	),
	'an empty image': group( heading( 'Soon' ), image( undefined ) ),
	'one paragraph': para( 'Just this.' ),
	'three services': services( 3 ),
	'two rows of quotes': quotes(),
	'a grid of four': grid( 2, 4 ),
	'a grid of pictures': group(
		b(
			'core/group',
			{ layout: { type: 'grid', minimumColumnWidth: '10rem' } },
			[ 'a', 'b', 'c', 'd', 'e' ].map( ( n ) => image( `${ n }.jpg` ) )
		)
	),
	'columns on their own': b(
		'core/columns',
		{ align: 'wide' },
		[ 1, 2, 3 ].map( ( i ) => card( `Plain ${ i }` ) )
	),
};

/**
 * A column holding one card: a picture, a heading and a paragraph.
 *
 * @param {string} title
 * @param {Object} extra The column's attributes.
 */
function card( title, extra = {} ) {
	return b( 'core/column', { width: '33.33%', ...extra }, [
		image( `${ title }.jpg` ),
		heading( title, 3 ),
		para( `About ${ title }.` ),
	] );
}

/**
 * A styled section: a heading, then a row of `count` cards.
 *
 * @param {number} count
 */
function services( count ) {
	return b(
		'core/group',
		{
			align: 'full',
			metadata: { name: 'Services', patternName: 'theme/services' },
			style: { color: { background: '#eee' } },
		},
		[
			heading( 'What we do' ),
			b(
				'core/columns',
				{ align: 'wide', style: { spacing: { blockGap: '2rem' } } },
				Array.from( { length: count }, ( _, i ) =>
					card( `Service ${ i + 1 }`, { style: { border: '1px' } } )
				)
			),
		]
	);
}

/** Two rows of three quotes. */
function quotes() {
	const row = ( from ) =>
		b(
			'core/columns',
			{ className: 'is-quotes' },
			[ 0, 1, 2 ].map( ( i ) =>
				b( 'core/column', {}, [
					b( 'core/quote', {}, [ para( `Quote ${ from + i }` ) ] ),
				] )
			)
		);
	return group( heading( 'They said' ), row( 1 ), row( 4 ) );
}

/**
 * A grid group of `cells` alike groups, `count` across.
 *
 * @param {number} count
 * @param {number} cells
 * @param {Object} extra More of the grid's layout.
 */
function grid( count, cells, extra = {} ) {
	return group(
		b(
			'core/group',
			{
				layout: {
					type: 'grid',
					...extra,
					...( count && { columnCount: count } ),
				},
			},
			Array.from( { length: cells }, ( _, i ) =>
				group( heading( `Place ${ i + 1 }`, 3 ), para( 'Address' ) )
			)
		)
	);
}

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

describe( 'Stacked, Centred and Card', () => {
	const keys = ( section ) => arrangements( section ).map( ( l ) => l.key );
	const paras = ( count ) =>
		Array.from( { length: count }, ( _, i ) => para( `Para ${ i + 1 }` ) );
	const flexRow = ( ...inner ) =>
		b( 'core/group', { layout: { type: 'flex' } }, inner );

	it( 'offers Stacked only for what is not already one stack', () => {
		expect( keys( SECTIONS[ 'text only' ] ) ).not.toContain(
			'content:stacked'
		);
		for ( const name of [
			'a cover hero',
			'text beside an image',
			'a media & text section',
			'a grid of four',
			'three services',
		] ) {
			expect( keys( SECTIONS[ name ] ) ).toContain( 'content:stacked' );
		}
		expect(
			keys( group( flexRow( para( 'A' ), para( 'B' ) ) ) )
		).toContain( 'content:stacked' );
	} );

	it( 'does not count one filled column or a vertical stack as side by side', () => {
		const oneColumn = group(
			columns( [ heading( 'A' ), para( 'B' ) ], [] )
		);
		const vertical = group(
			b(
				'core/group',
				{ layout: { type: 'flex', orientation: 'vertical' } },
				[ heading( 'A' ), para( 'B' ) ]
			)
		);
		expect( keys( oneColumn ) ).not.toContain( 'content:stacked' );
		expect( keys( vertical ) ).not.toContain( 'content:stacked' );
	} );

	it( 'offers Centred for six items or fewer with nothing side by side', () => {
		expect( keys( group( ...paras( 6 ) ) ) ).toContain( 'content:centred' );
		expect( keys( group( ...paras( 7 ) ) ) ).not.toContain(
			'content:centred'
		);
		expect( keys( SECTIONS[ 'a cover hero' ] ) ).toContain(
			'content:centred'
		);
		for ( const name of [
			'text beside an image',
			'a media & text section',
			'a grid of four',
		] ) {
			expect( keys( SECTIONS[ name ] ) ).not.toContain(
				'content:centred'
			);
		}
	} );

	it( 'offers Card for six items or fewer with no cover', () => {
		expect( keys( group( ...paras( 6 ) ) ) ).toContain( 'content:card' );
		expect( keys( group( ...paras( 7 ) ) ) ).not.toContain(
			'content:card'
		);
		expect( keys( SECTIONS[ 'text beside an image' ] ) ).toContain(
			'content:card'
		);
		expect( keys( SECTIONS[ 'a cover hero' ] ) ).not.toContain(
			'content:card'
		);
		expect(
			keys( group( b( 'core/cover', { url: 'a.jpg' }, paras( 1 ) ) ) )
		).not.toContain( 'content:card' );
	} );

	it( 'offers Card on a section with a background, which it keeps', () => {
		const section = b(
			'core/group',
			{ backgroundColor: 'accent-1' },
			paras( 2 )
		);
		const { block } = arrangements( section ).find(
			( l ) => l.key === 'content:card'
		);
		expect( block.attributes.backgroundColor ).toBe( 'accent-1' );
	} );

	it( 'leaves a Card when another layout is picked', () => {
		const { block } = arrangements(
			group( heading( 'A' ), image( 'a.jpg' ) )
		).find( ( l ) => l.key === 'content:card' );
		const moved = arrangements( block ).find(
			( l ) => l.key === 'content:picture-moved'
		).block;
		expect( moved.innerBlocks.map( ( x ) => x.name ) ).toEqual( [
			'core/image',
			'core/heading',
		] );
	} );

	it( 'does not offer Card on a section that is already one', () => {
		const { block } = arrangements( group( ...paras( 2 ) ) ).find(
			( l ) => l.key === 'content:card'
		);
		expect( keys( block ) ).not.toContain( 'content:card' );
	} );

	it( 'centres the text through the group, not the blocks in it', () => {
		const section = group( heading( 'A' ), para( 'B' ) );
		const { block } = arrangements( section ).find(
			( l ) => l.key === 'content:centred'
		);
		expect( block.attributes.className ).toBe( 'has-text-align-center' );
		expect( block.innerBlocks ).toEqual( section.innerBlocks );
	} );

	it( 'falls back to Stacked when nothing else applies', () => {
		const long = group(
			image( 'a.jpg' ),
			...paras( 3 ),
			image( 'b.jpg' ),
			...paras( 3 )
		);
		expect( keys( long ) ).toEqual( [ 'content:stacked' ] );
	} );
} );

describe( 'the section’s width', () => {
	const layoutOf = ( section, key ) =>
		arrangements( section ).find( ( l ) => l.key === 'content:' + key )
			.block.attributes.layout;
	const full = ( ...inner ) =>
		b(
			'core/group',
			{ align: 'full', layout: { type: 'constrained' } },
			inner
		);
	const wideColumns = ( ...cols ) => ( {
		...columns( ...cols ),
		attributes: { align: 'wide' },
	} );

	it( 'stays wide when all the content was in wide blocks', () => {
		const section = full(
			wideColumns(
				[ heading( 'A' ), para( 'B' ) ],
				[ image( 'a.jpg' ) ]
			),
			spacer()
		);

		expect( layoutOf( section, 'stacked' ) ).toEqual( {
			type: 'constrained',
			contentSize: WIDE,
		} );
	} );

	it( 'stays wide when the section was wide columns', () => {
		const section = wideColumns(
			[ heading( 'A' ), para( 'B' ) ],
			[ image( 'a.jpg' ) ]
		);

		expect( layoutOf( section, 'stacked' ).contentSize ).toBe( WIDE );
	} );

	it( 'stays wide when the group let its content fill it', () => {
		const section = b( 'core/group', { align: 'wide' }, [
			heading( 'A' ),
			para( 'B' ),
		] );

		expect( layoutOf( section, 'card' ).contentSize ).toBe( WIDE );
	} );

	it( 'stays as it was when only some of the content was wide', () => {
		const section = full(
			heading( 'A', 2, { align: 'wide' } ),
			para( 'B' ),
			image( 'a.jpg' )
		);

		expect( layoutOf( section, 'card' ) ).toEqual( {
			type: 'constrained',
		} );
	} );

	it( 'keeps a content width the section had', () => {
		const section = b(
			'core/group',
			{
				align: 'full',
				layout: { type: 'constrained', contentSize: '900px' },
			},
			[ wideColumns( [ heading( 'A' ) ], [ image( 'a.jpg' ) ] ) ]
		);

		expect( layoutOf( section, 'stacked' ).contentSize ).toBe( '900px' );
	} );

	it( 'keeps a cover’s content as narrow as it was', () => {
		const section = b( 'core/cover', { url: 'a.jpg', align: 'full' }, [
			heading( 'A' ),
			para( 'B' ),
		] );

		expect( layoutOf( section, 'picture-moved' ) ).toEqual( {
			type: 'constrained',
		} );
	} );

	it( 'stays wide after another layout', () => {
		const section = full(
			wideColumns( [ heading( 'A' ), para( 'B' ) ], [ image( 'a.jpg' ) ] )
		);
		const stacked = arrangements( section ).find(
			( l ) => l.key === 'content:stacked'
		).block;

		const constrained = arrangements( stacked )
			.map( ( l ) => l.block )
			.filter(
				( block ) =>
					block.name === 'core/group' &&
					block.attributes.layout?.type === 'constrained'
			);

		expect( constrained.length ).toBeGreaterThan( 0 );
		constrained.forEach( ( block ) =>
			expect( block.attributes.layout.contentSize ).toBe( WIDE )
		);
	} );
} );

describe( 'the section’s own design', () => {
	const layout = ( section, key ) =>
		arrangements( section ).find( ( l ) => l.key === 'content:' + key )
			.block;
	const ROOMY = {
		top: 'var:preset|spacing|60',
		bottom: 'var:preset|spacing|60',
		left: 'var:preset|spacing|50',
		right: 'var:preset|spacing|50',
	};
	const DESIGN = {
		align: 'full',
		anchor: 'about',
		tagName: 'section',
		className: 'is-style-section-1 extra',
		backgroundColor: 'accent-1',
		textColor: 'base',
		fontSize: 'large',
		metadata: { name: 'About', patternName: 'theme/about' },
		layout: { type: 'constrained', contentSize: '600px' },
		style: {
			border: { radius: '8px' },
			spacing: { padding: { top: '1px', bottom: '2px' } },
		},
	};
	const { metadata, layout: ownLayout, ...KEPT } = DESIGN;
	const designed = b( 'core/group', DESIGN, [
		heading( 'A' ),
		para( 'B' ),
		image( 'a.jpg' ),
	] );

	it.each( [ 'picture-moved', 'split-left', 'split-right', 'card' ] )(
		'keeps the section’s design in %s',
		( key ) => {
			const block = layout( designed, key );
			expect( block.name ).toBe( 'core/group' );
			expect( block.attributes ).toEqual( {
				...KEPT,
				metadata: { name: 'About' },
				layout: ownLayout,
			} );
		}
	);

	it( 'keeps the section’s design in Stacked and Split in two', () => {
		const beside = b( 'core/group', DESIGN, [
			columns( [ heading( 'A' ) ], [ para( 'B' ) ] ),
		] );
		expect( layout( beside, 'stacked' ).attributes ).toMatchObject( KEPT );
		const text = b( 'core/group', DESIGN, [
			heading( 'A' ),
			para( 'B' ),
			para( 'C' ),
		] );
		expect( layout( text, 'two-columns' ).attributes ).toMatchObject(
			KEPT
		);
	} );

	it( 'keeps the design and adds to the classes in Centered', () => {
		const { attributes } = layout( designed, 'centred' );
		expect( attributes ).toMatchObject( {
			...KEPT,
			className: 'is-style-section-1 extra has-text-align-center',
		} );
		expect( attributes.layout.type ).toBe( 'flex' );
	} );

	it( 'does not stay centred in another layout', () => {
		const centred = layout( designed, 'centred' );
		expect( layout( centred, 'split-left' ).attributes.className ).toBe(
			'is-style-section-1 extra'
		);
		const plain = layout(
			group( heading( 'A' ), image( 'a.jpg' ) ),
			'centred'
		);
		expect( layout( plain, 'split-left' ).attributes ).not.toHaveProperty(
			'className'
		);
	} );

	it( 'gives room only to a section that has none of its own', () => {
		const section = b(
			'core/group',
			{ style: { border: { radius: '8px' } } },
			[ heading( 'A' ), image( 'a.jpg' ) ]
		);
		expect( layout( section, 'picture-moved' ).attributes.style ).toEqual( {
			border: { radius: '8px' },
			spacing: { padding: ROOMY },
		} );
	} );

	it( 'does not add room again when a layout is changed again', () => {
		const once = layout( designed, 'split-left' );
		const twice = layout( once, 'picture-moved' );
		expect( twice.attributes.style ).toEqual( DESIGN.style );
	} );

	it( 'keeps how a row of buttons was set out', () => {
		const row = { layout: { type: 'flex', justifyContent: 'center' } };
		const section = group(
			heading( 'A' ),
			b( 'core/buttons', row, [
				button( 'One', '/1' ),
				button( 'Two', '/2' ),
			] )
		);
		const { block } = arrangements( section ).find(
			( l ) => l.key === 'content:card'
		);
		const [ , buttonRow ] = block.innerBlocks[ 0 ].innerBlocks;
		expect( buttonRow.name ).toBe( 'core/buttons' );
		expect( buttonRow.attributes ).toEqual( row );
		expect( buttonRow.innerBlocks ).toHaveLength( 2 );
	} );

	describe( 'groups around the content', () => {
		const inner = {
			align: 'wide',
			backgroundColor: 'accent-2',
			layout: { type: 'constrained' },
		};
		const nested = b( 'core/group', { align: 'full', textColor: 'base' }, [
			b( 'core/group', inner, [ heading( 'A' ), image( 'a.jpg' ) ] ),
		] );

		it( 'keeps each one, and only lays out inside the last', () => {
			const block = layout( nested, 'split-left' );
			expect( block.attributes ).toEqual( nested.attributes );
			expect( block.innerBlocks ).toHaveLength( 1 );
			expect( block.innerBlocks[ 0 ].attributes ).toMatchObject( inner );
			expect( block.innerBlocks[ 0 ].innerBlocks[ 0 ].name ).toBe(
				'core/columns'
			);
		} );

		it( 'adds no room when an outer group has its own', () => {
			const padded = b(
				'core/group',
				{ style: { spacing: { padding: { top: '9px' } } } },
				[ b( 'core/group', {}, [ heading( 'A' ), image( 'a.jpg' ) ] ) ]
			);
			const block = layout( padded, 'picture-moved' );
			expect( block.innerBlocks[ 0 ].attributes.style ).toBeUndefined();
		} );

		it( 'does not go into a grid or a row', () => {
			const row = b( 'core/group', { backgroundColor: 'accent-1' }, [
				b( 'core/group', { layout: { type: 'flex' } }, [
					heading( 'A' ),
					image( 'a.jpg' ),
				] ),
			] );
			const block = layout( row, 'picture-moved' );
			expect( block.attributes.backgroundColor ).toBe( 'accent-1' );
			expect( block.innerBlocks.map( ( x ) => x.name ) ).toEqual( [
				'core/image',
				'core/heading',
			] );
		} );
	} );

	describe( 'Picture behind', () => {
		it( 'becomes one cover, keeping where the section sits and its room', () => {
			const block = layout( designed, 'cover' );
			expect( block.name ).toBe( 'core/cover' );
			expect( block.attributes ).toMatchObject( {
				align: 'full',
				anchor: 'about',
				className: 'extra',
				metadata: { name: 'About' },
				style: { spacing: DESIGN.style.spacing },
			} );
		} );

		it( 'leaves out colours and fonts, which would not suit a picture', () => {
			const { attributes } = layout( designed, 'cover' );
			for ( const key of [
				'backgroundColor',
				'textColor',
				'fontSize',
				'tagName',
			] ) {
				expect( attributes ).not.toHaveProperty( key );
			}
			expect( attributes.style ).not.toHaveProperty( 'border' );
		} );

		it( 'does not sit inside the groups around the content', () => {
			const nested = group(
				b( 'core/group', { backgroundColor: 'accent-2' }, [
					heading( 'A' ),
					image( 'a.jpg' ),
				] )
			);
			const block = layout( nested, 'cover' );
			expect( block.name ).toBe( 'core/cover' );
			expect( block.innerBlocks.map( ( x ) => x.name ) ).toEqual( [
				'core/heading',
			] );
		} );
	} );

	describe( 'when the section isn’t a group', () => {
		const cover = b(
			'core/cover',
			{
				url: 'a.jpg',
				alt: '',
				id: 1,
				dimRatio: 40,
				overlayColor: 'black',
				minHeight: 500,
				isDark: true,
				align: 'full',
				className: 'is-style-fancy extra',
				layout: { type: 'constrained' },
				style: { spacing: { padding: { top: '3px' } } },
			},
			[ heading( 'A' ) ]
		);

		it( 'takes only where a cover sits and its room', () => {
			expect( layout( cover, 'picture-moved' ).attributes ).toEqual( {
				align: 'full',
				className: 'extra',
				layout: { type: 'constrained' },
				style: { spacing: { padding: { top: '3px' } } },
			} );
		} );

		it( 'takes a media & text’s colours and width, but not its media', () => {
			const section = b(
				'core/media-text',
				{
					mediaUrl: 'a.jpg',
					mediaType: 'image',
					mediaPosition: 'right',
					backgroundColor: 'accent-1',
					align: 'wide',
				},
				[ heading( 'A' ) ]
			);
			expect( layout( section, 'stacked' ).attributes ).toEqual( {
				backgroundColor: 'accent-1',
				align: 'wide',
				layout: { type: 'constrained', contentSize: WIDE },
				style: { spacing: { padding: ROOMY } },
			} );
		} );

		it( 'takes a columns block’s colours, but not its alignment of columns', () => {
			const section = b(
				'core/columns',
				{ textColor: 'base', verticalAlignment: 'center' },
				[
					b( 'core/column', {}, [ heading( 'A' ) ] ),
					b( 'core/column', {}, [ image( 'a.jpg' ) ] ),
				]
			);
			const { attributes } = layout( section, 'stacked' );
			expect( attributes.textColor ).toBe( 'base' );
			expect( attributes ).not.toHaveProperty( 'verticalAlignment' );
		} );

		it( 'leaves a content block’s style on the block', () => {
			const section = para( 'A', {
				align: 'wide',
				textColor: 'base',
				fontSize: 'large',
			} );
			const { attributes, innerBlocks } = layout( section, 'centred' );
			expect( attributes ).not.toHaveProperty( 'textColor' );
			expect( attributes ).not.toHaveProperty( 'fontSize' );
			expect( innerBlocks ).toEqual( [ section ] );
		} );
	} );
} );
