/**
 * Layouts made from a section's own content.
 *
 * A section is taken apart into its content, in order: its pictures and its
 * content blocks (headings, paragraphs, buttons, lists, quotes and so on).
 * Each layout puts the same content back in new layout blocks: groups,
 * columns, button rows and covers. The content blocks themselves are used as
 * they are, so nothing is added, removed or changed; only how it's laid out,
 * and sometimes where a picture sits, is new. The section keeps its own design:
 * its colours, fonts, room and width stay on the block around the content.
 *
 * Works on plain { name, attributes, innerBlocks } objects and never changes
 * the blocks it's given. `../index.js` offers these after the families'
 * arrangements, as editor blocks.
 *
 * Ported from Ito, in Automattic/site-editing-experiments
 * (https://github.com/Automattic/site-editing-experiments/tree/trunk/ito).
 */

/**
 * WordPress dependencies
 */
import { __, _n, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { pictureOf, roleOf, signature } from './content';

const b = ( name, attributes = {}, innerBlocks = [] ) => ( {
	name,
	attributes,
	innerBlocks,
} );

/** Room around a section, from the theme's spacing sizes. */
const ROOMY = {
	top: 'var:preset|spacing|60',
	bottom: 'var:preset|spacing|60',
	left: 'var:preset|spacing|50',
	right: 'var:preset|spacing|50',
};

/**
 * A section's content in order. Each part is a picture ({ picture, image }:
 * the picture, and the Image block when it was one) or a content block
 * ({ block }), whole with whatever is inside it. A button also has its row's
 * attributes ({ row }), so a new row is set out the same.
 *
 * @param {Object}   block
 * @param {Object[]} parts Collects the parts.
 * @return {Object[]} The parts.
 */
function partsOf( block, parts = [] ) {
	const role = roleOf( block );
	const inner = () =>
		( block.innerBlocks || [] ).forEach( ( x ) => partsOf( x, parts ) );
	if ( block.name === 'core/buttons' ) {
		for ( const button of block.innerBlocks || [] ) {
			parts.push( { block: button, row: block.attributes } );
		}
	} else if ( role === 'wrap' ) {
		inner();
	} else if ( role === 'hold' ) {
		parts.push( { picture: pictureOf( block ) } );
		inner();
	} else if ( role === 'picture' ) {
		parts.push( { picture: pictureOf( block ), image: block } );
	} else if ( role !== 'skip' ) {
		parts.push( { block } );
	}
	return parts;
}

const isPicture = ( part ) => ! part.block;
const headingOf = ( parts ) =>
	parts.find( ( p ) => p.block?.name === 'core/heading' );

/**
 * Whether a picture can be shown as a cover's background: it has an image,
 * and nothing that only an Image block can show (a caption or a link).
 *
 * @param {Object} part
 */
function canCover( part ) {
	const a = part.image?.attributes || {};
	// A caption may be rich text, which is an object even when it's empty.
	return !! part.picture && ! String( a.caption ?? '' ) && ! a.href;
}

/**
 * Parts as blocks: pictures as Image blocks, and buttons next to each other
 * in one row.
 *
 * @param {Object[]} parts
 * @return {Object[]} Blocks.
 */
function place( parts ) {
	const out = [];
	let row = null; // the button row being filled
	for ( const part of parts ) {
		if ( part.block?.name === 'core/button' ) {
			if ( ! row ) {
				row = b( 'core/buttons', part.row );
				out.push( row );
			}
			row.innerBlocks.push( part.block );
			continue;
		}
		row = null;
		out.push(
			part.block ||
				part.image ||
				b( 'core/image', { ...part.picture, sizeSlug: 'large' } )
		);
	}
	return out;
}

const column = ( parts ) =>
	b( 'core/column', { verticalAlignment: 'center' }, place( parts ) );

/** The most content items a section can have for Centred or Card to suit it. */
const SHORT = 6;

const everyBlock = ( block ) => [
	block,
	...( block.innerBlocks || [] ).flatMap( everyBlock ),
];

/**
 * Whether a block puts things next to each other, so stacking would change it.
 *
 * @param {Object} block
 */
function isSideBySide( block ) {
	const { name, attributes, innerBlocks = [] } = block;
	if ( name === 'core/media-text' || isGrid( block ) ) {
		return true;
	}
	if ( name === 'core/columns' ) {
		return innerBlocks.filter( ( c ) => c.innerBlocks?.length ).length > 1;
	}
	const layout = attributes?.layout;
	return (
		name === 'core/group' &&
		layout?.type === 'flex' &&
		layout.orientation !== 'vertical' &&
		innerBlocks.length > 1
	);
}

const hasSideBySide = ( section ) => everyBlock( section ).some( isSideBySide );
const hasCover = ( section ) =>
	everyBlock( section ).some(
		( x ) => x.name === 'core/cover' && pictureOf( x )
	);

/** A Card's tint, which also says a section is one. */
const TINT = 'color-mix(in srgb, currentColor 6%, transparent)';

const isCard = ( block ) => block.attributes?.style?.color?.background === TINT;
const hasCard = ( section ) => everyBlock( section ).some( isCard );

/** What a block of another kind can hand on to a group around the content. */
const DESIGN = [
	'align',
	'anchor',
	'className',
	'backgroundColor',
	'textColor',
	'gradient',
	'fontSize',
	'fontFamily',
	'borderColor',
	'style',
];

const CENTRED = 'has-text-align-center';

/**
 * Attributes with undefined ones left out.
 *
 * @param {Object} attributes
 */
const defined = ( attributes ) =>
	Object.fromEntries(
		Object.entries( attributes ).filter( ( [ , v ] ) => v !== undefined )
	);

/**
 * Class names without Centered's, which belongs to one layout, and without the
 * ones that `drop` matches.
 *
 * @param {string}  [className]
 * @param {?RegExp} [drop]
 * @return {string|undefined} The class names, if any are left.
 */
function keptClasses( className = '', drop = null ) {
	return (
		className
			.split( /\s+/ )
			.filter( ( c ) => c && c !== CENTRED && ! drop?.test( c ) )
			.join( ' ' ) || undefined
	);
}

/**
 * Attributes without the pattern they came from.
 *
 * @param {Object} attributes
 */
function notAsPattern( attributes ) {
	const { metadata: { patternName, ...metadata } = {}, ...rest } = attributes;
	return {
		...rest,
		...( Object.keys( metadata ).length && { metadata } ),
	};
}

/** Block styles belong to one kind of block. */
const BLOCK_STYLE = /^is-style-/;

/**
 * Where a section sits and what it's called, and its spacing: what it keeps
 * whatever block it becomes.
 *
 * @param {Object} section
 */
function placeOf( section ) {
	const { align, anchor, className, metadata, style } = notAsPattern(
		section.attributes || {}
	);
	return defined( {
		align,
		anchor,
		metadata,
		className: keptClasses( className, BLOCK_STYLE ),
		style: style?.spacing && { spacing: style.spacing },
	} );
}

/**
 * The design a block hands on to the group that replaces it.
 *
 * @param {Object} block
 */
function designOf( block ) {
	const attributes = notAsPattern( block.attributes || {} );
	if ( block.name === 'core/group' ) {
		const { layout, ...rest } = attributes;
		return defined( {
			...rest,
			className: keptClasses( rest.className ),
		} );
	}
	if ( block.name === 'core/cover' ) {
		return placeOf( block );
	}
	if ( roleOf( block ) === 'wrap' || roleOf( block ) === 'hold' ) {
		const handed = Object.fromEntries(
			DESIGN.map( ( key ) => [ key, attributes[ key ] ] )
		);
		return defined( {
			...handed,
			metadata: attributes.metadata,
			className: keptClasses( attributes.className, BLOCK_STYLE ),
		} );
	}
	// A content block's style stays on the block.
	const { align, metadata } = attributes;
	return defined( { align, metadata } );
}

const hasRoom = ( block ) => !! block.attributes?.style?.spacing?.padding;

/** The theme's wide width, for content that was wide. */
export const WIDE = 'var(--wp--style--global--wide-size)';

const isWide = ( block ) =>
	[ 'wide', 'full' ].includes( block.attributes?.align );

/**
 * Whether a block only makes room, which doesn't say how wide the content is.
 *
 * @param {Object} block
 */
const isSpacing = ( block ) =>
	[ 'core/spacer', 'core/separator' ].includes( block.name );

/**
 * Whether all of a section's content was wide: a wide block like columns or
 * media & text, or a group or cover whose content is all in wide blocks, or a
 * group that lets its content fill it. A layout that puts the content in a
 * constrained group would make it narrow, so the group keeps that width.
 *
 * @param {Object} inner The group that holds the content, or the section.
 */
function wasWide( inner ) {
	const { layout } = inner.attributes || {};
	// A cover's content is constrained unless it says otherwise.
	const constrained =
		layout?.type === 'constrained' ||
		( inner.name === 'core/cover' && ! layout?.type );
	if ( inner.name !== 'core/group' && ! constrained ) {
		return isWide( inner );
	}
	if ( constrained ) {
		const content = ( inner.innerBlocks || [] ).filter(
			( block ) => ! isSpacing( block )
		);
		return content.length > 0 && content.every( isWide );
	}
	// A group that isn't constrained lets its content fill it.
	return isWide( inner ) && layout?.type !== 'flex';
}

/**
 * The layout for the group a layout makes: constrained, as the section's was
 * if it had one, but as wide as the content was.
 *
 * @param {Object} inner The group that holds the content, or the section.
 */
function layoutOf( inner ) {
	const layout =
		inner.name === 'core/group' &&
		inner.attributes?.layout?.type === 'constrained'
			? inner.attributes.layout
			: { type: 'constrained' };
	return wasWide( inner ) && ! layout.contentSize
		? { ...layout, contentSize: WIDE }
		: layout;
}

/**
 * Attributes with room around the content, unless there's some already.
 *
 * @param {Object}  attributes
 * @param {boolean} roomy      Whether there's some already.
 */
const withRoom = ( attributes, roomy ) =>
	roomy
		? attributes
		: {
				...attributes,
				style: {
					...attributes.style,
					spacing: { ...attributes.style?.spacing, padding: ROOMY },
				},
			};

/**
 * The section's own design, for its layouts: the groups that only hold another
 * group, which stay as they are, and the design for the block a layout makes
 * inside them. A Card isn't kept, so that picking another layout leaves it.
 *
 * @param {Object} section
 * @return {Object} { around, attributes, layout, cover }: the groups, the new
 *                  block's attributes and its layout, and the attributes for
 *                  a cover in place of them all.
 */
function ownDesign( section ) {
	const around = [];
	let inner = section;
	while (
		inner.name === 'core/group' &&
		inner.innerBlocks?.length === 1 &&
		inner.innerBlocks[ 0 ].name === 'core/group' &&
		! isSideBySide( inner.innerBlocks[ 0 ] ) &&
		! isCard( inner.innerBlocks[ 0 ] )
	) {
		around.push( inner );
		inner = inner.innerBlocks[ 0 ];
	}
	return {
		around,
		attributes: withRoom(
			designOf( inner ),
			[ ...around, inner ].some( hasRoom )
		),
		layout: layoutOf( inner ),
		cover: withRoom( placeOf( section ), hasRoom( section ) ),
	};
}

/**
 * A block in the groups around the content.
 *
 * @param {Object}   block
 * @param {Object[]} around
 */
const inGroupsAround = ( block, around ) =>
	around.reduceRight(
		( inner, outer ) => ( {
			...outer,
			attributes: notAsPattern( outer.attributes ),
			innerBlocks: [ inner ],
		} ),
		block
	);

/**
 * A group with the section's design, holding some blocks.
 *
 * @param {Object}   own    From ownDesign().
 * @param {Object[]} blocks
 */
const designedGroup = ( own, blocks ) =>
	b( 'core/group', { ...own.attributes, layout: own.layout }, blocks );

/**
 * The layouts, each with when it applies and how it's built. `own` is the
 * section's design, from ownDesign().
 */
const RECIPES = [
	{
		key: 'stacked',
		label: () => __( 'Stacked' ),
		// Already one stack, it would look the same.
		applies: ( pictures, text, parts, section ) =>
			hasSideBySide( section ) || hasCover( section ),
		build: ( parts, own ) => designedGroup( own, place( parts ) ),
	},
	{
		key: 'centred',
		label: () => __( 'Centered' ),
		applies: ( pictures, text, parts, section ) =>
			parts.length <= SHORT && ! hasSideBySide( section ),
		build: ( parts, own ) =>
			b(
				'core/group',
				{
					...own.attributes,
					// The text inherits this; the blocks themselves stay as they are.
					className: [ own.attributes.className, CENTRED ]
						.filter( Boolean )
						.join( ' ' ),
					layout: {
						type: 'flex',
						orientation: 'vertical',
						justifyContent: 'center',
					},
				},
				place( parts )
			),
	},
	{
		key: 'picture-moved',
		label: ( parts ) =>
			isPicture( parts[ 0 ] )
				? __( 'Picture last' )
				: __( 'Picture first' ),
		applies: ( pictures, text ) => pictures.length === 1 && text.length > 0,
		build: ( parts, own, [ picture ], text ) =>
			designedGroup(
				own,
				place(
					isPicture( parts[ 0 ] )
						? [ ...text, picture ]
						: [ picture, ...text ]
				)
			),
	},
	...[ 'left', 'right' ].map( ( side ) => ( {
		key: 'split-' + side,
		label: () =>
			side === 'left'
				? __( 'Picture on the left' )
				: __( 'Picture on the right' ),
		applies: ( pictures, text ) => pictures.length === 1 && text.length > 0,
		build: ( parts, own, [ picture ], text ) => {
			const cols = [ column( [ picture ] ), column( text ) ];
			return designedGroup( own, [
				b(
					'core/columns',
					{ align: 'wide', verticalAlignment: 'center' },
					side === 'left' ? cols : cols.reverse()
				),
			] );
		},
	} ) ),
	{
		key: 'cover',
		label: () => __( 'Picture behind' ),
		applies: ( pictures, text ) =>
			pictures.length === 1 &&
			canCover( pictures[ 0 ] ) &&
			text.length > 0,
		// The picture takes the place of the section's background, and of any
		// groups around the content, which would only frame it. Dark text or a
		// font of its own might not suit it.
		alone: true,
		build: ( parts, own, [ picture ], text ) =>
			b(
				'core/cover',
				{
					...own.cover,
					...picture.picture,
					dimRatio: 50,
					minHeight: 480,
					isDark: true,
					layout: { type: 'constrained' },
				},
				place( text )
			),
	},
	{
		key: 'two-columns',
		label: () => __( 'Split in two' ),
		// For text: the split layouts are for a picture. The first heading goes
		// above both columns.
		applies: ( pictures, text ) =>
			! pictures.length && text.length - !! headingOf( text ) >= 2,
		build: ( parts, own ) => {
			const head = headingOf( parts );
			const rest = parts.filter( ( p ) => p !== head );
			const half = Math.ceil( rest.length / 2 );
			return designedGroup( own, [
				...place( head ? [ head ] : [] ),
				b( 'core/columns', { align: 'wide' }, [
					b( 'core/column', {}, place( rest.slice( 0, half ) ) ),
					b( 'core/column', {}, place( rest.slice( half ) ) ),
				] ),
			] );
		},
	},
	{
		key: 'card',
		label: () => __( 'Card' ),
		applies: ( pictures, text, parts, section ) =>
			parts.length <= SHORT &&
			! hasCard( section ) &&
			! hasCover( section ),
		build: ( parts, own ) =>
			designedGroup( own, [
				b(
					'core/group',
					{
						layout: { type: 'constrained' },
						style: {
							color: { background: TINT },
							border: { radius: '16px' },
							spacing: {
								padding: {
									top: 'var:preset|spacing|50',
									bottom: 'var:preset|spacing|50',
									left: 'var:preset|spacing|50',
									right: 'var:preset|spacing|50',
								},
							},
						},
					},
					place( parts )
				),
			] ),
	},
];

/** The most columns a Columns block can have. */
const MOST_COLUMNS = 6;

const kindOf = ( block ) => signature( block ).join( '|' );

const isGrid = ( block ) =>
	block.name === 'core/group' && block.attributes?.layout?.type === 'grid';

/**
 * Alike cards among a block's children, if there are some: Columns blocks
 * next to each other whose columns all hold the same kind of content (empty
 * columns aside).
 *
 * @param {Object[]} children
 * @return {?Object} { start, end, first, count, cells }: where they are among
 *                   the children, the first row, how many columns they're
 *                   in, and the cards.
 */
function cardsIn( children ) {
	for ( let start = 0; start < children.length; start++ ) {
		const first = children[ start ];
		const cells = [];
		let end = start;
		while ( children[ end ]?.name === 'core/columns' ) {
			const filled = children[ end ].innerBlocks.filter( kindOf );
			const kind = kindOf( cells[ 0 ] || filled[ 0 ] || {} );
			if (
				! filled.length ||
				filled.some( ( c ) => kindOf( c ) !== kind )
			) {
				break;
			}
			cells.push( ...filled );
			end++;
		}
		if ( cells.length >= 2 ) {
			return {
				start,
				end,
				first,
				count: first.innerBlocks.length,
				cells,
			};
		}
	}
	return null;
}

/**
 * A grid among a block's children, if there's one with at least two cells.
 *
 * @param {Object[]} children
 * @return {?Object} { start, end, grid }
 */
function gridIn( children ) {
	const start = children.findIndex(
		( x ) => isGrid( x ) && x.innerBlocks.length >= 2
	);
	return start < 0
		? null
		: { start, end: start + 1, grid: children[ start ] };
}

/**
 * Cards in rows of `n` like the first row, with the last filled up with
 * empty columns so every column keeps the same width.
 *
 * @param {Object}   cards       From cardsIn().
 * @param {Object}   cards.first The first row.
 * @param {Object[]} cards.cells The cards.
 * @param {number}   n
 * @return {Object[]} The rows.
 */
function inColumns( { first, cells }, n ) {
	const rows = [];
	for ( let i = 0; i < cells.length; i += n ) {
		// A width was meant for the old number of columns.
		const row = cells.slice( i, i + n ).map( ( cell ) => {
			const { width, ...attributes } = cell.attributes || {};
			return { ...cell, attributes };
		} );
		while ( row.length < n ) {
			row.push( b( 'core/column' ) );
		}
		rows.push( { ...first, innerBlocks: row } );
	}
	return rows;
}

/**
 * The first match in some blocks, looking at each level before the one
 * inside it, so cards inside the cards are left as they are.
 *
 * @param {Object[]}                        children
 * @param {(children: Object[]) => ?Object} match    Finds { start, end, ... } among some children.
 * @return {?Object} The match, with rebuild( blocks ): the children with
 *                   `blocks` in its place.
 */
function findFirst( children, match ) {
	const found = match( children );
	if ( found ) {
		return {
			...found,
			rebuild: ( blocks ) => [
				...children.slice( 0, found.start ),
				...blocks,
				...children.slice( found.end ),
			],
		};
	}
	for ( const [ i, child ] of children.entries() ) {
		const inner = findFirst( child.innerBlocks || [], match );
		if ( inner ) {
			return {
				...inner,
				rebuild: ( blocks ) =>
					children.map( ( x, j ) =>
						j === i
							? { ...x, innerBlocks: inner.rebuild( blocks ) }
							: x
					),
			};
		}
	}
	return null;
}

/**
 * Rebuilt blocks as the section: one block, with the attributes every
 * section keeps.
 *
 * @param {Object[]} blocks
 * @param {Object}   top
 */
function asSection( blocks, top ) {
	// When the section was the columns, its rows need a group to be one section.
	const block =
		blocks.length === 1 ? blocks[ 0 ] : b( 'core/group', {}, blocks );
	const { metadata, ...attributes } = block.attributes;
	return { ...block, attributes: { ...attributes, ...top } };
}

/**
 * The section with its cards in one fewer and one more column, styled as it
 * was.
 *
 * @param {Object} section
 * @param {Object} top     The attributes every section keeps.
 * @return {Object[]} { key, label, block } for each.
 */
function columnCounts( section, top ) {
	const found = findFirst( [ section ], cardsIn );
	if ( ! found ) {
		return [];
	}
	return [ found.count - 1, found.count + 1 ]
		.filter( ( n ) => n >= 1 && n <= MOST_COLUMNS )
		.map( ( n ) => ( {
			key: 'content:columns-' + n,
			/* translators: %d: a number of columns. */
			label: sprintf( _n( '%d column', '%d columns', n ), n ),
			block: asSection( found.rebuild( inColumns( found, n ) ), top ),
		} ) );
}

/**
 * A grid cell without a span, if it's a group that has one. Other blocks are
 * content, so they're left as they are.
 *
 * @param {Object} cell
 */
function unspanned( cell ) {
	const { layout = {}, ...style } = cell.attributes?.style || {};
	if (
		cell.name !== 'core/group' ||
		! ( 'columnSpan' in layout || 'rowSpan' in layout )
	) {
		return cell;
	}
	const { columnSpan, rowSpan, ...rest } = layout;
	const next = {
		...style,
		...( Object.keys( rest ).length && { layout: rest } ),
	};
	const { style: _, ...attributes } = cell.attributes;
	return {
		...cell,
		attributes: {
			...attributes,
			...( Object.keys( next ).length && { style: next } ),
		},
	};
}

/**
 * A grid cell spanning more than one column or row. A content block goes in
 * a group that spans, so the block itself doesn't change.
 *
 * @param {Object} cell
 * @param {Object} span { columnSpan, rowSpan }
 */
function spanning( cell, span ) {
	if ( cell.name !== 'core/group' ) {
		return b( 'core/group', { style: { layout: span } }, [ cell ] );
	}
	const style = cell.attributes?.style || {};
	return {
		...cell,
		attributes: {
			...cell.attributes,
			style: { ...style, layout: { ...style.layout, ...span } },
		},
	};
}

/**
 * The shapes a grid of `count` cells can take: every number across (up to
 * six), the first cell two by two among the rest, and the first cell as a
 * banner over rows the rest fill.
 *
 * @param {number} count
 * @return {Object[]} { key, label, across, span }
 */
function shapesFor( count ) {
	const shapes = [];
	for ( let n = 1; n <= Math.min( count, MOST_COLUMNS ); n++ ) {
		shapes.push( {
			key: String( n ),
			label: sprintf(
				/* translators: 1: rows, 2: columns. */
				__( '%1$d × %2$d grid' ),
				Math.ceil( count / n ),
				n
			),
			across: n,
		} );
	}
	for ( const n of [ 3, 4 ] ) {
		// Enough cells to fill the two rows beside the featured one.
		if ( count >= 1 + 2 * ( n - 2 ) ) {
			shapes.push( {
				key: 'featured-' + n,
				/* translators: %d: a number of columns. */
				label: sprintf( __( 'Featured, %d across' ), n ),
				across: n,
				span: { columnSpan: 2, rowSpan: 2 },
			} );
		}
	}
	for ( let n = 2; n <= MOST_COLUMNS; n++ ) {
		if ( count - 1 >= n && ( count - 1 ) % n === 0 ) {
			shapes.push( {
				key: 'banner-' + n,
				/* translators: %d: a number of columns. */
				label: sprintf( __( 'Banner, then %d across' ), n ),
				across: n,
				span: { columnSpan: n },
			} );
		}
	}
	return shapes;
}

/**
 * The shape a grid has, as a key from shapesFor(), if it has a set number
 * across.
 *
 * @param {Object} grid
 */
function shapeOf( grid ) {
	const n = grid.attributes.layout.columnCount;
	if ( ! n ) {
		return null;
	}
	const first = grid.innerBlocks[ 0 ].attributes?.style?.layout || {};
	if ( first.columnSpan === 2 && first.rowSpan === 2 ) {
		return 'featured-' + n;
	}
	return first.columnSpan === n ? 'banner-' + n : String( n );
}

/**
 * The section with its first grid in other shapes. Only the grid's number
 * across and its first cell's span change.
 *
 * @param {Object} section
 * @param {Object} top     The attributes every section keeps.
 * @return {Object[]} { key, label, block } for each.
 */
function gridShapes( section, top ) {
	const found = findFirst( [ section ], gridIn );
	if ( ! found ) {
		return [];
	}
	const { grid } = found;
	const current = shapeOf( grid );
	return shapesFor( grid.innerBlocks.length )
		.filter( ( shape ) => shape.key !== current )
		.map( ( shape ) => {
			const cells = grid.innerBlocks.map( unspanned );
			// A minimum width would let the grid show fewer across than the shape.
			const { minimumColumnWidth, ...layout } = grid.attributes.layout;
			if ( shape.span ) {
				cells[ 0 ] = spanning( cells[ 0 ], shape.span );
			}
			const next = {
				...grid,
				attributes: {
					...grid.attributes,
					layout: { ...layout, columnCount: shape.across },
				},
				innerBlocks: cells,
			};
			return {
				key: 'content:grid-' + shape.key,
				label: shape.label,
				block: asSection( found.rebuild( [ next ] ), top ),
			};
		} );
}

/**
 * The layouts a section's content can be shown in.
 *
 * @param {Object} section The section's top block.
 * @return {Object[]} { key, label, block } for each layout that applies.
 */
export function arrangements( section ) {
	const parts = partsOf( section );
	if ( ! parts.length ) {
		return [];
	}
	const pictures = parts.filter( isPicture );
	const text = parts.filter( ( p ) => ! isPicture( p ) );
	// The section keeps its alignment and any name it was given, but it's no
	// longer the pattern it came from.
	const { align, metadata } = notAsPattern( section.attributes || {} );
	const top = defined( { align, metadata } );
	const own = ownDesign( section );
	const fromRecipe = ( r ) => {
		const block = r.build( parts, own, pictures, text );
		return {
			key: 'content:' + r.key,
			label: r.label( parts ),
			block: r.alone ? block : inGroupsAround( block, own.around ),
		};
	};
	const layouts = [
		...columnCounts( section, top ),
		...gridShapes( section, top ),
		...RECIPES.filter( ( r ) =>
			r.applies( pictures, text, parts, section )
		).map( fromRecipe ),
	];
	// Every section has a choice: Stacked, if nothing else suits it.
	return layouts.length
		? layouts
		: [ fromRecipe( RECIPES.find( ( r ) => r.key === 'stacked' ) ) ];
}
