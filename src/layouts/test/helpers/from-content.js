/**
 * Block builders and sample sections shared by the generated-layout tests.
 */
/**
 * Builds a block object.
 *
 * @param {string} name        Block name.
 * @param {Object} attributes  Block attributes.
 * @param {Array}  innerBlocks Inner blocks.
 */
export const b = ( name, attributes = {}, innerBlocks = [] ) => ( {
	name,
	attributes,
	innerBlocks,
} );
export const group = ( ...inner ) =>
	b( 'core/group', { layout: { type: 'constrained' } }, inner );
export const columns = ( ...cols ) =>
	b(
		'core/columns',
		{},
		cols.map( ( inner ) => b( 'core/column', {}, inner ) )
	);
export const heading = ( content, level = 2, extra = {} ) =>
	b( 'core/heading', { content, level, ...extra } );
export const para = ( content, extra = {} ) =>
	b( 'core/paragraph', { content, ...extra } );
export const image = ( url, extra = {} ) =>
	b( 'core/image', { url, alt: `Alt ${ url }`, id: 7, ...extra } );
export const buttons = ( ...inner ) => b( 'core/buttons', {}, inner );
export const button = ( text, url ) => b( 'core/button', { text, url } );
export const spacer = () => b( 'core/spacer', { height: '40px' } );

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
export function contentOf( block ) {
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

export const SECTIONS = {
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
export function services( count ) {
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
export function quotes() {
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
export function grid( count, cells, extra = {} ) {
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
