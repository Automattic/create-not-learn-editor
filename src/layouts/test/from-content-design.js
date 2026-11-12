/**
 * Generated layouts: Stacked, Centred and Card, and how the section's width
 * and own design carry into each layout.
 */
import { describe, expect, it } from 'vitest';

import { arrangements, WIDE } from '../variants/from-content';
import {
	b,
	group,
	columns,
	heading,
	para,
	image,
	button,
	spacer,
	SECTIONS,
} from './helpers/from-content';

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
