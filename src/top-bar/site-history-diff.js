/**
 * What each change of a Publish site changed, from what to what, for the
 * site history to show at two levels: a one-line summary, and every detail.
 *
 * Worked out just before the save, while the editor still holds both the
 * saved record and the edited one, and kept in the log with the entry. So
 * an entry reads the same later, whatever the theme or palette has become,
 * and needs no revisions to describe itself. Restore still uses revisions.
 *
 * A detail is `{ label, kind, from, to }`: `kind` is "changed", "added" or
 * "removed", and `from` and `to` are `{ text, color?, image? }`, ready to
 * show.
 */

/**
 * WordPress dependencies
 */
import { parse } from '@wordpress/block-serialization-default-parser';
import { getBlockType } from '@wordpress/blocks';
import { store as coreStore } from '@wordpress/core-data';
import { __, _n, sprintf } from '@wordpress/i18n';

// Kept short, so a big publish doesn't bloat the log.
const MAX_DETAILS = 60;
const MAX_TEXT = 140;

const SETTING_LABELS = {
	title: __( 'Site name' ),
	description: __( 'Tagline' ),
	site_logo: __( 'Logo' ),
	site_icon: __( 'Browser icon' ),
	show_on_front: __( 'Homepage' ),
	page_on_front: __( 'Homepage' ),
	page_for_posts: __( 'Blog page' ),
	posts_per_page: __( 'Posts shown at once' ),
};

/*
 * Style paths in the editor's words. Pairs first, as `color.text` reads
 * "Text color" where `text` alone, under an element, reads "Text".
 */
const PATH_LABELS = {
	'color.background': __( 'Background color' ),
	'color.text': __( 'Text color' ),
	'color.gradient': __( 'Gradient' ),
	'color.palette': __( 'Colors' ),
	'color.gradients': __( 'Gradients' ),
	'color.duotone': __( 'Duotone' ),
	'typography.fontFamilies': __( 'Fonts' ),
	'typography.fontSizes': __( 'Font sizes' ),
	'spacing.spacingSizes': __( 'Spacing sizes' ),
};

const SEGMENT_LABELS = {
	fontFamily: __( 'Font' ),
	fontSize: __( 'Font size' ),
	fontWeight: __( 'Font weight' ),
	fontStyle: __( 'Font style' ),
	lineHeight: __( 'Line height' ),
	letterSpacing: __( 'Letter spacing' ),
	textTransform: __( 'Letter case' ),
	textDecoration: __( 'Decoration' ),
	padding: __( 'Padding' ),
	margin: __( 'Margin' ),
	blockGap: __( 'Block spacing' ),
	border: __( 'Border' ),
	radius: __( 'Radius' ),
	width: __( 'Width' ),
	style: __( 'Style' ),
	shadow: __( 'Shadow' ),
	top: __( 'top' ),
	right: __( 'right' ),
	bottom: __( 'bottom' ),
	left: __( 'left' ),
	link: __( 'Links' ),
	button: __( 'Buttons' ),
	heading: __( 'Headings' ),
	h1: __( 'Heading 1' ),
	h2: __( 'Heading 2' ),
	h3: __( 'Heading 3' ),
	h4: __( 'Heading 4' ),
	h5: __( 'Heading 5' ),
	h6: __( 'Heading 6' ),
	caption: __( 'Captions' ),
	cite: __( 'Citations' ),
	':hover': __( 'on hover' ),
	':focus': __( 'on focus' ),
	background: __( 'Background' ),
	text: __( 'Text' ),
	backgroundColor: __( 'Background color' ),
	textColor: __( 'Text color' ),
	content: __( 'Text' ),
	label: __( 'Label' ),
	url: __( 'Link' ),
	ref: __( 'Menu' ),
};

// Grouping keys that say nothing on their own.
const SILENT_SEGMENTS = [
	'styles',
	'settings',
	'elements',
	'blocks',
	'color',
	'typography',
	'spacing',
	'theme',
	'custom',
	'default',
];

const PRESET =
	/^var(?::preset\|([a-z-]+)\||\(--wp--preset--([a-z-]+)--)([^)|]+)\)?$/;
const COLOR = /^(#[0-9a-f]{3,8}|(rgb|hsl)a?\([^)]*\))$/i;

function clip( text ) {
	const value = String( text ?? '' )
		.replace( /\s+/g, ' ' )
		.trim();

	return value.length > MAX_TEXT
		? `${ value.slice( 0, MAX_TEXT - 1 ) }…`
		: value;
}

function stripTags( html ) {
	return clip( String( html || '' ).replace( /<[^>]*>/g, ' ' ) );
}

function isPlainObject( value ) {
	return (
		value !== null && typeof value === 'object' && ! Array.isArray( value )
	);
}

function blockTitle( name ) {
	return (
		getBlockType( name )?.title ||
		String( name || '' )
			.replace( /^core\//, '' )
			.replace( /-/g, ' ' )
			.replace( /^./, ( first ) => first.toUpperCase() )
	);
}

/**
 * A style path, `elements.link.color.text` say, as words: "Links › Text
 * color".
 *
 * @param {string[]} path Keys, from the top.
 * @return {string} The label.
 */
export function describePath( path ) {
	const words = [];

	for ( let i = 0; i < path.length; i++ ) {
		const segment = path[ i ];
		const pair = PATH_LABELS[ `${ segment }.${ path[ i + 1 ] }` ];

		if ( pair ) {
			words.push( pair );
			i++;
		} else if ( segment.startsWith( '[' ) ) {
			// An item of a preset list, by its name, added when flattened.
			words.push( segment.slice( 1, -1 ) );
		} else if ( path[ i - 1 ] === 'blocks' ) {
			words.push( blockTitle( segment ) );
		} else if ( SEGMENT_LABELS[ segment ] ) {
			words.push( SEGMENT_LABELS[ segment ] );
		} else if ( ! SILENT_SEGMENTS.includes( segment ) ) {
			words.push( segment );
		}
	}

	return words.join( ' › ' ) || __( 'Style' );
}

/**
 * Every leaf of a styles or settings object, by its path. A list of
 * presets, a palette say, is opened up by slug, so one colour changing is
 * one change, not the whole list.
 *
 * @param {*}        value Object to flatten.
 * @param {string[]} path  Keys so far.
 * @param {Object}   out   Leaves, by joined path.
 * @return {Object} `{ [path]: { path, value } }`.
 */
function flatten( value, path = [], out = {} ) {
	if ( isPlainObject( value ) ) {
		Object.keys( value ).forEach( ( key ) =>
			flatten( value[ key ], [ ...path, key ], out )
		);
	} else if (
		Array.isArray( value ) &&
		value.length &&
		value.every( ( item ) => isPlainObject( item ) && item.slug )
	) {
		value.forEach( ( item ) => {
			const itemPath = [ ...path, `[${ item.name || item.slug }]` ];
			out[ `${ path.join( '.' ) }.${ item.slug }` ] = {
				path: itemPath,
				value: item,
			};
		} );
	} else {
		out[ path.join( '.' ) ] = { path, value };
	}

	return out;
}

/**
 * The site's presets by kind and slug, to name what a style points at.
 *
 * @param {Object[]} settingsList Settings to look in, most specific first.
 * @return {Function} `( kind, slug ) => preset`, or undefined.
 */
function makePresetLookup( settingsList ) {
	const lists = {
		color: [ 'color', 'palette' ],
		gradient: [ 'color', 'gradients' ],
		'font-family': [ 'typography', 'fontFamilies' ],
		'font-size': [ 'typography', 'fontSizes' ],
		spacing: [ 'spacing', 'spacingSizes' ],
	};

	return ( kind, slug ) => {
		const [ group, key ] = lists[ kind ] || [];

		for ( const settings of settingsList ) {
			const origins = settings?.[ group ]?.[ key ];
			const all = Array.isArray( origins )
				? origins
				: Object.values( origins || {} ).flat();
			const found = all.find( ( preset ) => preset?.slug === slug );

			if ( found ) {
				return found;
			}
		}

		return undefined;
	};
}

/**
 * A style value, ready to show.
 *
 * @param {*}        value      The value.
 * @param {Function} findPreset From `makePresetLookup`.
 * @return {Object} `{ text, color? }`.
 */
function describeValue( value, findPreset ) {
	if ( value === undefined || value === null || value === '' ) {
		return { text: __( 'Default' ) };
	}

	if ( isPlainObject( value ) ) {
		// A preset itself, from a list opened up by `flatten`.
		if ( value.color ) {
			return { text: clip( value.color ), color: value.color };
		}

		if ( value.fontFamily || value.size ) {
			return {
				text: clip( value.name || value.fontFamily || value.size ),
			};
		}

		return { text: clip( JSON.stringify( value ) ) };
	}

	if ( Array.isArray( value ) ) {
		return { text: clip( value.join( ', ' ) ) };
	}

	const text = String( value );
	const preset = text.match( PRESET );

	if ( preset ) {
		const kind = preset[ 1 ] || preset[ 2 ];
		const found = findPreset( kind, preset[ 3 ] );
		const name = found?.name || preset[ 3 ];

		return found?.color
			? { text: clip( name ), color: found.color }
			: { text: clip( name ) };
	}

	if ( COLOR.test( text.trim() ) ) {
		return { text: clip( text ), color: text.trim() };
	}

	return { text: clip( text ) };
}

function isSame( a, b ) {
	return JSON.stringify( a ) === JSON.stringify( b );
}

function diffObjects( before, after, findPreset, prefix = [] ) {
	const from = flatten( before || {}, prefix );
	const to = flatten( after || {}, prefix );

	return [ ...new Set( [ ...Object.keys( from ), ...Object.keys( to ) ] ) ]
		.filter( ( key ) => ! isSame( from[ key ]?.value, to[ key ]?.value ) )
		.map( ( key ) => {
			const path = ( to[ key ] || from[ key ] ).path;
			let kind = 'changed';

			if ( ! from[ key ] ) {
				kind = path[ path.length - 1 ].startsWith( '[' )
					? 'added'
					: 'changed';
			} else if ( ! to[ key ] ) {
				kind = path[ path.length - 1 ].startsWith( '[' )
					? 'removed'
					: 'changed';
			}

			return {
				label: describePath( path ),
				kind,
				from: describeValue( from[ key ]?.value, findPreset ),
				to: describeValue( to[ key ]?.value, findPreset ),
			};
		} );
}

/*
 * Blocks.
 */

function flattenBlocks( blocks, out = [] ) {
	( blocks || [] ).forEach( ( block ) => {
		if ( block.blockName ) {
			out.push( {
				name: block.blockName,
				attrs: block.attrs || {},
				text: stripTags( block.innerHTML ),
			} );
		}

		flattenBlocks( block.innerBlocks, out );
	} );

	return out;
}

function describeBlock( block ) {
	return clip(
		block.text ||
			block.attrs.label ||
			block.attrs.content ||
			block.attrs.slug ||
			''
	);
}

/**
 * Pair the blocks before and after that are the same block, in order, by
 * name: the longest common run, as a text diff pairs lines.
 *
 * @param {Object[]} before Blocks before, flattened.
 * @param {Object[]} after  Blocks after, flattened.
 * @return {Array[]} `[ beforeBlock|null, afterBlock|null ]` pairs.
 */
function pairBlocks( before, after ) {
	const rows = before.length;
	const cols = after.length;
	const lengths = Array.from( { length: rows + 1 }, () =>
		new Array( cols + 1 ).fill( 0 )
	);

	for ( let i = rows - 1; i >= 0; i-- ) {
		for ( let j = cols - 1; j >= 0; j-- ) {
			lengths[ i ][ j ] =
				before[ i ].name === after[ j ].name
					? lengths[ i + 1 ][ j + 1 ] + 1
					: Math.max( lengths[ i + 1 ][ j ], lengths[ i ][ j + 1 ] );
		}
	}

	const pairs = [];
	let i = 0;
	let j = 0;

	while ( i < rows || j < cols ) {
		if ( i < rows && j < cols && before[ i ].name === after[ j ].name ) {
			pairs.push( [ before[ i++ ], after[ j++ ] ] );
		} else if (
			j < cols &&
			( i >= rows || lengths[ i ][ j + 1 ] >= lengths[ i + 1 ][ j ] )
		) {
			pairs.push( [ null, after[ j++ ] ] );
		} else {
			pairs.push( [ before[ i++ ], null ] );
		}
	}

	return pairs;
}

function diffBlocks( beforeContent, afterContent, findPreset ) {
	const before = flattenBlocks( parse( beforeContent || '' ) );
	const after = flattenBlocks( parse( afterContent || '' ) );
	const details = [];

	pairBlocks( before, after ).forEach( ( [ from, to ] ) => {
		const title = blockTitle( ( from || to ).name );

		if ( ! from ) {
			details.push( {
				label: sprintf(
					/* translators: %s: A block's name. */
					__( '%s added' ),
					title
				),
				kind: 'added',
				to: { text: describeBlock( to ) || title },
			} );
			return;
		}

		if ( ! to ) {
			details.push( {
				label: sprintf(
					/* translators: %s: A block's name. */
					__( '%s removed' ),
					title
				),
				kind: 'removed',
				from: { text: describeBlock( from ) || title },
			} );
			return;
		}

		if ( from.text !== to.text ) {
			details.push( {
				label: sprintf(
					/* translators: %s: A block's name. */
					__( '%s › Text' ),
					title
				),
				kind: 'changed',
				from: { text: from.text || __( 'Empty' ) },
				to: { text: to.text || __( 'Empty' ) },
			} );
		}

		const { style: fromStyle, ...fromAttrs } = from.attrs;
		const { style: toStyle, ...toAttrs } = to.attrs;

		diffObjects( fromStyle, toStyle, findPreset ).forEach( ( detail ) =>
			details.push( {
				...detail,
				label: `${ title } › ${ detail.label }`,
			} )
		);

		[
			...new Set( [
				...Object.keys( fromAttrs ),
				...Object.keys( toAttrs ),
			] ),
		]
			.filter(
				( key ) =>
					key !== 'metadata' &&
					! isSame( fromAttrs[ key ], toAttrs[ key ] )
			)
			.forEach( ( key ) => {
				// A colour attribute holds a palette slug.
				const asPreset = ( value ) =>
					/color$/i.test( key ) && typeof value === 'string'
						? `var:preset|color|${ value }`
						: value;

				details.push( {
					label: `${ title } › ${ SEGMENT_LABELS[ key ] || key }`,
					kind: 'changed',
					from: describeValue(
						asPreset( fromAttrs[ key ] ),
						findPreset
					),
					to: describeValue( asPreset( toAttrs[ key ] ), findPreset ),
				} );
			} );
	} );

	return details;
}

function summariseBlocks( details ) {
	const count = ( kind ) =>
		details.filter( ( detail ) => detail.kind === kind ).length;
	const parts = [];
	const added = count( 'added' );
	const removed = count( 'removed' );
	const changed = count( 'changed' );

	if ( changed ) {
		parts.push(
			sprintf(
				/* translators: %d: Number of changes to blocks. */
				_n( '%d edit', '%d edits', changed ),
				changed
			)
		);
	}

	if ( added ) {
		parts.push(
			sprintf(
				/* translators: %d: Number of blocks added. */
				_n( '%d block added', '%d blocks added', added ),
				added
			)
		);
	}

	if ( removed ) {
		parts.push(
			sprintf(
				/* translators: %d: Number of blocks removed. */
				_n( '%d block removed', '%d blocks removed', removed ),
				removed
			)
		);
	}

	return parts.join( ', ' );
}

/**
 * One line for a change, from its details.
 *
 * @param {Object[]} details   The change's details.
 * @param {boolean}  isContent Whether it is a record of blocks.
 * @return {string} The summary.
 */
export function summarise( details, isContent ) {
	if ( ! details.length ) {
		return '';
	}

	if ( details.length === 1 ) {
		const [ only ] = details;

		if ( only.kind === 'added' || only.kind === 'removed' ) {
			return only.label;
		}

		return sprintf(
			/* translators: 1: What changed, 2: its old value, 3: its new value. */
			__( '%1$s: %2$s → %3$s' ),
			only.label,
			only.from?.text,
			only.to?.text
		);
	}

	if ( isContent ) {
		return summariseBlocks( details );
	}

	// What changed, by the last word of each label: "Background, Text and 5
	// more".
	const names = [
		...new Set(
			details.map( ( { label } ) => label.split( ' › ' ).pop() )
		),
	];

	if ( names.length <= 3 ) {
		return names.join( ', ' );
	}

	return sprintf(
		/* translators: 1: Names of the first changes, 2: how many more. */
		_n( '%1$s and %2$d more', '%1$s and %2$d more', names.length - 2 ),
		names.slice( 0, 2 ).join( ', ' ),
		names.length - 2
	);
}

/*
 * Site settings.
 */

function describeSetting( property, site, { getPageTitle, getMediaUrl } ) {
	const value = site?.[ property ];

	if ( property === 'site_logo' || property === 'site_icon' ) {
		const url = Number( value ) ? getMediaUrl( Number( value ) ) : '';

		return Number( value )
			? { text: __( 'Image' ), ...( url ? { image: url } : {} ) }
			: { text: __( 'None' ) };
	}

	if ( property === 'show_on_front' || property === 'page_on_front' ) {
		if ( site?.show_on_front !== 'page' ) {
			return { text: __( 'Latest posts' ) };
		}

		return {
			text: clip( getPageTitle( site?.page_on_front ) || __( 'A page' ) ),
		};
	}

	if ( property === 'page_for_posts' ) {
		return { text: clip( getPageTitle( value ) || __( 'None' ) ) };
	}

	return { text: value === '' ? __( 'Empty' ) : clip( value ) };
}

function getContent( record ) {
	const content = record?.content;

	if ( typeof content === 'function' ) {
		return content( record );
	}

	return typeof content === 'string' ? content : content?.raw || '';
}

function getTitle( record ) {
	const title = record?.title;

	return clip( typeof title === 'string' ? title : title?.raw || '' );
}

/**
 * What a change about to be published changes, from what to what. Called
 * before the save, while the saved record is still the old one.
 *
 * @param {Object} change   A described change: `kind`, `name`, `key`,
 *                          `property` for a site setting.
 * @param {Object} registry Data registry.
 * @return {{summary: string, details: Object[]}} The summary and details.
 */
export function describeChangeDetails( change, registry ) {
	const store = registry.select( coreStore );
	const { kind, name, key, property } = change;
	let details = [];
	let isContent = false;

	if ( kind === 'root' && name === 'site' ) {
		const saved = store.getRawEntityRecord( 'root', 'site' );
		const edited = store.getEditedEntityRecord( 'root', 'site' );
		const context = {
			getPageTitle: ( id ) =>
				( Number( id ) &&
					getTitle(
						store.getEditedEntityRecord(
							'postType',
							'page',
							Number( id )
						)
					) ) ||
				'',
			getMediaUrl: ( id ) => {
				const media = store.getEntityRecord(
					'postType',
					'attachment',
					id
				);

				return (
					media?.media_details?.sizes?.thumbnail?.source_url ||
					media?.source_url ||
					''
				);
			},
		};

		details = [
			{
				label: SETTING_LABELS[ property ] || property,
				kind: 'changed',
				from: describeSetting( property, saved, context ),
				to: describeSetting( property, edited, context ),
			},
		];
	} else if ( kind === 'root' && name === 'globalStyles' ) {
		const saved = store.getRawEntityRecord( kind, name, key ) || {};
		const edited = store.getEditedEntityRecord( kind, name, key ) || {};
		const findPreset = makePresetLookup( [
			edited.settings,
			saved.settings,
			store.__experimentalGetCurrentThemeBaseGlobalStyles?.()?.settings,
		] );

		details = [
			...diffObjects( saved.styles, edited.styles, findPreset, [
				'styles',
			] ),
			...diffObjects( saved.settings, edited.settings, findPreset, [
				'settings',
			] ),
		];
	} else if ( kind === 'postType' ) {
		const saved = store.getRawEntityRecord( kind, name, key ) || {};
		const edited = store.getEditedEntityRecord( kind, name, key ) || {};
		const findPreset = makePresetLookup( [
			store.__experimentalGetCurrentThemeBaseGlobalStyles?.()?.settings,
		] );
		const fromTitle = getTitle( saved );
		const toTitle = getTitle( edited );

		isContent = true;

		if ( fromTitle !== toTitle ) {
			details.push( {
				label: __( 'Name' ),
				kind: 'changed',
				from: { text: fromTitle || __( 'Untitled' ) },
				to: { text: toTitle || __( 'Untitled' ) },
			} );
		}

		details.push(
			...diffBlocks(
				getContent( saved ),
				getContent( edited ),
				findPreset
			)
		);

		// Publishing a draft menu.
		if ( saved.status && edited.status && saved.status !== edited.status ) {
			details.push( {
				label: __( 'Status' ),
				kind: 'changed',
				from: { text: saved.status },
				to: { text: edited.status },
			} );
		}
	}

	return {
		summary: clip( summarise( details, isContent ) ),
		details: details.slice( 0, MAX_DETAILS ),
		...( details.length > MAX_DETAILS
			? { more: details.length - MAX_DETAILS }
			: {} ),
	};
}
