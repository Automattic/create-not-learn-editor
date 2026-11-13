/**
 * What the editor's WebMCP tools do. Their names, descriptions and inputs are
 * in `declarations.js`. See the README's "Driving the editor with WebMCP".
 *
 * Each change is made as the editor's own controls make it, with the same
 * functions, so it is an unsaved edit like any other: it shows on the canvas
 * at once, can be undone, and waits for the person to save it.
 */

/**
 * WordPress dependencies
 */
import { store as blockEditorStore } from '@wordpress/block-editor';
import { cloneBlock } from '@wordpress/blocks';
import { store as coreDataStore } from '@wordpress/core-data';
import { dispatch, resolveSelect, select } from '@wordpress/data';
import { decodeEntities } from '@wordpress/html-entities';
import { __, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { getSectionArrangements } from '../layouts/variants';
import { openPage } from '../page-finder/open-page';
import { getColorUpdate } from '../pickers/section-design';
import { getWidthChange } from '../pickers/section-width';
import {
	getPatternDescription,
	getPatternTitle,
} from '../routes/content/page-layouts';
import { HOMEPAGE } from '../routes/content/pages/homepage-state';
import { searchSectionDesigns } from '../section-picker/groups';
import {
	createBlankSection,
	getPatternSectionBlocks,
	isLayoutPattern,
	isSectionPattern,
	isThemePattern,
} from '../section-picker/patterns';
import {
	getCanvasDevice,
	getCanvasMode,
	MODE_BROWSE,
	MODE_COMPOSE,
	requestCanvasMode,
	setCanvasDevice,
} from '../site-canvas/mode';
import { getBlockIndex } from '../site-canvas/writing-mode';
import { describeChanges, getDirtyRecords } from '../top-bar/use-changes';
import {
	getActiveWorkspace,
	getAvailableWorkspaces,
	setActiveWorkspace,
} from '../workspaces';
import {
	areSectionsReady,
	describePage,
	getCanvas,
	getColorChoicesFor,
	getSection,
	getSectionBlock,
	getSectionName,
	getSections,
	NO_PAGE_OPEN,
	requireCanvas,
	waitFor,
} from './canvas';
import { markConnected, recordChange, startTask } from './connection';
import { showChange } from './flash';
import { findByName } from './match';
import { describeSiteStyle, setSiteStyle } from './site-style';

const PAGE_STATUSES = 'publish,future,draft,pending,private';
const MAX_DESIGNS = 40;

/**
 * Show the person a change on the canvas, and note it for them to look back
 * on from the canvas toolbar.
 *
 * @param {string}  text     What changed, in the person's words.
 * @param {?string} clientId The block that shows it, if one does.
 */
function changed( text, clientId = null ) {
	showChange( clientId );
	recordChange( text, clientId );
}

function getTitle( record ) {
	return decodeEntities(
		record?.title?.raw ?? record?.title?.rendered ?? record?.title ?? ''
	);
}

async function getPages() {
	const resolve = resolveSelect( coreDataStore );
	const [ pages, site ] = await Promise.all( [
		resolve.getEntityRecords( 'postType', 'page', {
			context: 'edit',
			order: 'asc',
			orderby: 'menu_order',
			per_page: 100,
			status: PAGE_STATUSES,
		} ),
		resolve.getEntityRecord( 'root', 'site' ),
	] );
	const edited = select( coreDataStore ).getEditedEntityRecord(
		'root',
		'site'
	);
	const showOnFront = edited?.show_on_front ?? site?.show_on_front;
	const homepageId =
		showOnFront === 'page'
			? Number( edited?.page_on_front ?? site?.page_on_front ) || null
			: null;

	return { homepageId, pages: pages || [] };
}

function connect( { agent } ) {
	if ( typeof agent !== 'string' || ! agent.trim() ) {
		throw new Error( "Give your product's name." );
	}

	markConnected( agent );

	return { shows: `Connected to ${ agent.trim() }` };
}

function startTaskTool( { title } ) {
	const kept = startTask( title );

	if ( ! kept ) {
		throw new Error( 'Give what you are working on, in a few words.' );
	}

	return { shows: kept };
}

function setWorkspace( { workspace } ) {
	const before = getActiveWorkspace();
	const available = getAvailableWorkspaces();
	const wanted = String( workspace ?? '' ).trim();
	const next =
		available.find( ( item ) => item.id === wanted.toLowerCase() ) ||
		findByName( available, wanted, ( item ) => item.label, 'workspace' );

	// Unlike the sidebar's switcher, this leaves the screen as it is, so
	// the page being worked on stays open.
	setActiveWorkspace( next.id );

	return {
		workspace: { id: next.id, name: next.label },
		before: { id: before.id, name: before.label },
		workspaces: available.map( ( item ) => ( {
			id: item.id,
			name: item.label,
		} ) ),
	};
}

const MODES = [ 'browse', 'edit', 'compose' ];
const DEVICES = [ 'desktop', 'tablet', 'mobile' ];
// Long enough for Browse's preview to load the page.
const MODE_WAIT_MS = 20000;

function isAskingAboutChanges() {
	return Boolean(
		document.querySelector( '.cnl-site-canvas__unsaved-dialog' )
	);
}

function describeCanvas() {
	const mode = getCanvasMode();

	return {
		mode,
		device: mode === MODE_COMPOSE ? 'desktop' : getCanvasDevice(),
	};
}

async function setCanvas( { mode, device } ) {
	if ( ! mode && ! device ) {
		throw new Error( 'Give a mode, a device or both.' );
	}

	if ( mode && ! MODES.includes( mode ) ) {
		throw new Error( `The modes are ${ MODES.join( ', ' ) }.` );
	}

	if ( device && ! DEVICES.includes( device ) ) {
		throw new Error( `The devices are ${ DEVICES.join( ', ' ) }.` );
	}

	if ( ! getCanvas() ) {
		throw new Error( NO_PAGE_OPEN );
	}

	if ( device ) {
		setCanvasDevice( device );
	}

	if ( mode && mode !== getCanvasMode() ) {
		requestCanvasMode( mode );

		try {
			await waitFor(
				() => getCanvasMode() === mode || isAskingAboutChanges(),
				`The canvas didn't move to ${ mode } in time.`,
				MODE_WAIT_MS
			);
		} catch ( error ) {
			requestCanvasMode( null );
			throw error;
		}

		if ( getCanvasMode() !== mode ) {
			return {
				...describeCanvas(),
				waiting:
					'Browse only shows what is saved, so the editor has asked the person to save or discard their unsaved changes. The canvas moves to Browse once they have. Leave the choice to them.',
			};
		}
	}

	return {
		...describeCanvas(),
		...( mode === MODE_COMPOSE && device && device !== 'desktop'
			? {
					note: `Compose always shows the page on a desktop. It shows on ${ device } again on leaving Compose.`,
				}
			: {} ),
		...( getCanvasMode() === MODE_BROWSE
			? {
					note: 'Browse shows the saved site. The tools that change the page move the canvas back to Edit.',
				}
			: {} ),
	};
}

async function listPages() {
	const { homepageId, pages } = await getPages();
	const openId = getCanvas()?.postId;

	return {
		pages: pages.map( ( page ) => ( {
			id: page.id,
			title: getTitle( page ),
			status: page.status,
			...( page.parent ? { parent: page.parent } : {} ),
			...( page.id === homepageId ? { isHomepage: true } : {} ),
			...( page.id === openId ? { isOpen: true } : {} ),
		} ) ),
		...( homepageId ? {} : { homepage: 'Shows the latest posts' } ),
	};
}

async function openPageTool( { page } ) {
	const { homepageId, pages } = await getPages();
	const wanted = String( page ?? '' ).trim();
	let id;

	if ( /^(home|homepage|front page)$/i.test( wanted ) ) {
		id = homepageId ?? HOMEPAGE;
	} else if ( /^\d+$/.test( wanted ) ) {
		id = Number( wanted );

		if ( ! pages.some( ( item ) => item.id === id ) ) {
			throw new Error( `There is no page with ID ${ id }.` );
		}
	} else {
		id = findByName( pages, wanted, getTitle, 'page' ).id;
	}

	openPage( id === homepageId ? HOMEPAGE : id );

	await waitFor( () => {
		const canvas = getCanvas();

		return (
			canvas &&
			( typeof id !== 'number' || canvas.postId === id ) &&
			areSectionsReady( canvas )
		);
	}, "The page didn't open in the canvas in time. Try cnl-get-page in a moment." );

	return describePage();
}

async function getDesigns() {
	const resolve = resolveSelect( coreDataStore );
	const [ patterns, theme ] = await Promise.all( [
		resolve.getBlockPatterns(),
		resolve.getCurrentTheme(),
	] );
	const designs = ( patterns || [] ).filter(
		( pattern ) =>
			isSectionPattern( pattern ) && ! isLayoutPattern( pattern )
	);
	const isTheme = ( pattern ) => isThemePattern( pattern, theme );

	return [
		...designs.filter( isTheme ),
		...designs.filter( ( pattern ) => ! isTheme( pattern ) ),
	].map( ( pattern ) => ( { pattern, fromTheme: isTheme( pattern ) } ) );
}

async function listDesigns( { search } ) {
	const designs = await getDesigns();
	const found = searchSectionDesigns(
		designs.map( ( design ) => design.pattern ),
		search || ''
	);

	return {
		designs: found.slice( 0, MAX_DESIGNS ).map( ( pattern ) => ( {
			name: pattern.name,
			title: getPatternTitle( pattern ),
			...( getPatternDescription( pattern )
				? { description: getPatternDescription( pattern ) }
				: {} ),
			...( designs.find( ( design ) => design.pattern === pattern )
				?.fromTheme
				? { fromTheme: true }
				: {} ),
		} ) ),
		...( found.length > MAX_DESIGNS
			? {
					more: `${
						found.length - MAX_DESIGNS
					} more. Search to narrow them down.`,
				}
			: {} ),
	};
}

function listChanges() {
	const store = select( coreDataStore );
	const changes = describeChanges( getDirtyRecords( select ), {
		getEntityConfig: store.getEntityConfig,
		getPageTitle: ( id ) =>
			getTitle(
				Number( id ) &&
					store.getEditedEntityRecord(
						'postType',
						'page',
						Number( id )
					)
			),
		site: store.getEditedEntityRecord( 'root', 'site' ),
	} );

	return {
		changes: changes.map( ( change ) => ( {
			change: change.label,
			detail: change.detail,
			showsOn: change.isSiteWide ? 'every page' : 'one page',
		} ) ),
		note: 'Nothing is live until the person saves, with Save or Review changes in the editor.',
	};
}

async function addSection( { design, after } ) {
	const canvas = requireCanvas();
	const sections = getSections( canvas );
	const place = after ?? sections.length;

	if ( place < 0 || place > sections.length ) {
		throw new Error(
			`There is no section ${ place } to add it after. Use 0 for the top, up to ${ sections.length }.`
		);
	}

	const index = getBlockIndex( sections, -1, place );
	let blocks = [ createBlankSection() ];
	let added = 'Added a blank section';
	let note = __( 'Added a blank section' );

	if ( design ) {
		const designs = await getDesigns();
		const wanted = String( design ).trim();
		const { pattern } =
			designs.find( ( item ) => item.pattern.name === wanted ) ||
			findByName(
				designs,
				wanted,
				( item ) => getPatternTitle( item.pattern ),
				'design'
			);

		blocks = getPatternSectionBlocks( pattern );
		added = `Added "${ getPatternTitle( pattern ) }"`;
		note = sprintf(
			/* translators: %s: A section design's name. */
			__( 'Added “%s”' ),
			getPatternTitle( pattern )
		);
	}

	// Without selecting it, which would pick the section and open its bar.
	dispatch( blockEditorStore ).insertBlocks(
		blocks,
		index,
		canvas.rootClientId,
		false
	);
	changed( note, blocks[ 0 ]?.clientId );

	return {
		done: `${ added } as section ${ place + 1 }.`,
		...describePage(),
	};
}

function moveSection( { section, to } ) {
	const canvas = requireCanvas();
	const sections = getSections( canvas );
	const from = Number( section ) - 1;
	const moved = getSection( sections, section );
	const target = Number( to ) - 1;

	if ( target < 0 || target >= sections.length ) {
		throw new Error(
			`Section numbers run from 1 to ${ sections.length }.`
		);
	}

	const name = getSectionName( moved );

	dispatch( blockEditorStore ).moveBlocksToPosition(
		moved.clientIds,
		canvas.rootClientId,
		canvas.rootClientId,
		getBlockIndex( sections, from, target )
	);
	changed(
		/* translators: %s: A section's name. */
		sprintf( __( 'Moved “%s”' ), name ),
		moved.clientIds[ 0 ]
	);

	return {
		done: `Moved section ${ section } to ${ to }.`,
		...describePage(),
	};
}

function duplicateSection( { section } ) {
	const canvas = requireCanvas();
	const copied = getSection( getSections( canvas ), section );

	const name = getSectionName( copied );

	dispatch( blockEditorStore ).duplicateBlocks( copied.clientIds, false );
	changed(
		/* translators: %s: A section's name. */
		sprintf( __( 'Copied “%s”' ), name ),
		getSections( canvas )[ Number( section ) ]?.clientIds[ 0 ]
	);

	return {
		done: `Copied section ${ section } to section ${
			Number( section ) + 1
		}.`,
		...describePage(),
	};
}

function removeSection( { section } ) {
	const canvas = requireCanvas();
	const removed = getSection( getSections( canvas ), section );

	const name = getSectionName( removed );

	dispatch( blockEditorStore ).removeBlocks( removed.clientIds, false );
	/* translators: %s: A section's name. */
	recordChange( sprintf( __( 'Removed “%s”' ), name ) );

	return { done: `Removed section ${ section }.`, ...describePage() };
}

/**
 * A change to a section's design, in Edit design's words.
 *
 * @param {Object}  changes        What changed.
 * @param {?string} changes.color  The colour picked, if one was.
 * @param {?string} changes.layout The layout picked, if one was.
 * @param {?string} changes.width  The width picked, if one was.
 * @param {string}  name           The section's name.
 * @return {string} The words.
 */
function describeStyleChange( { color, layout, width }, name ) {
	if ( [ color, layout, width ].filter( Boolean ).length > 1 ) {
		/* translators: %s: A section's name. */
		return sprintf( __( 'Changed the design of “%s”' ), name );
	}

	if ( color ) {
		/* translators: %s: A section's name. */
		return sprintf( __( 'Changed the colour of “%s”' ), name );
	}

	if ( layout ) {
		/* translators: %s: A section's name. */
		return sprintf( __( 'Changed the layout of “%s”' ), name );
	}

	/* translators: %s: A section's name. */
	return sprintf( __( 'Changed the width of “%s”' ), name );
}

function styleSection( { section, color, layout, width } ) {
	const canvas = requireCanvas();
	const target = getSection( getSections( canvas ), section );
	const { replaceBlock, updateBlockAttributes } =
		dispatch( blockEditorStore );
	const done = [];

	if ( target.isText ) {
		throw new Error(
			`Section ${ section } is plain text, which has no colours, layouts or widths of its own.`
		);
	}

	if ( ! color && ! layout && ! width ) {
		throw new Error( 'Give a color, a layout or a width.' );
	}

	let clientId = target.clientIds[ 0 ];
	const name = getSectionName( target );

	// The layout first, as it swaps the section for a new block.
	if ( layout ) {
		const layouts = getSectionArrangements( getSectionBlock( clientId ) );

		if ( ! layouts ) {
			throw new Error(
				`Section ${ section } has no other layouts. Its content isn't one the editor can rearrange.`
			);
		}

		const option = findByName(
			layouts.options,
			layout,
			( item ) => item.label,
			'layout'
		);
		const next = cloneBlock( option.block );

		replaceBlock( clientId, next );
		clientId = next.clientId;
		done.push( `layout to ${ option.label }` );
	}

	if ( color ) {
		const block = getSectionBlock( clientId );
		const colors = getColorChoicesFor( block );

		if ( ! colors ) {
			throw new Error(
				`Section ${ section } has no colours to change to: its blocks set their own, or no other colour can be read on it.`
			);
		}

		const option = findByName(
			colors.offer.options,
			color,
			( item ) => item.label,
			'colour'
		);

		updateBlockAttributes(
			clientId,
			getColorUpdate( block, colors.choices.options, option.name )
		);
		done.push( `colour to ${ option.label }` );
	}

	if ( width ) {
		const change = getWidthChange( getSectionBlock( clientId ), width );

		if ( ! change ) {
			throw new Error(
				`Section ${ section } can't run ${ width }. Its width options are in cnl-get-page.`
			);
		}

		if ( change.clientIds.length ) {
			updateBlockAttributes( change.clientIds, change.attributes );
		}

		done.push( `width to ${ width }` );
	}

	changed( describeStyleChange( { color, layout, width }, name ), clientId );

	return {
		done: `Changed section ${ section }'s ${ done.join( ', ' ) }.`,
		...describePage(),
	};
}

async function setSiteStyleTool( input ) {
	const done = await setSiteStyle( input );

	if ( ! done.length ) {
		throw new Error( 'Give a look, a palette or fonts.' );
	}

	recordChange( __( "Changed the site's look" ) );

	return {
		done: `Changed the site's ${ done.join( ', ' ) }, on every page.`,
		...( await describeSiteStyle() ),
	};
}

async function setSiteTitle( { title, tagline } ) {
	const edits = {
		...( typeof title === 'string' ? { title } : {} ),
		...( typeof tagline === 'string' ? { description: tagline } : {} ),
	};

	if ( ! Object.keys( edits ).length ) {
		throw new Error( 'Give a title or a tagline.' );
	}

	await resolveSelect( coreDataStore ).getEntityRecord( 'root', 'site' );
	dispatch( coreDataStore ).editEntityRecord(
		'root',
		'site',
		undefined,
		edits
	);

	if ( edits.title !== undefined ) {
		changed(
			__( 'Changed the site title' ),
			select( blockEditorStore ).getBlocksByName( 'core/site-title' )[ 0 ]
		);
	} else {
		recordChange( __( 'Changed the tagline' ) );
	}

	return {
		done: 'Changed the site title, on every page.',
		...( await describeSiteStyle() ),
	};
}

const RUN = {
	'cnl-connect': connect,
	'cnl-start-task': startTaskTool,
	'cnl-set-workspace': setWorkspace,
	'cnl-set-canvas': setCanvas,
	'cnl-list-pages': listPages,
	'cnl-open-page': openPageTool,
	'cnl-get-page': () => describePage(),
	'cnl-get-designs': listDesigns,
	'cnl-get-site-style': () => describeSiteStyle(),
	'cnl-get-changes': listChanges,
	'cnl-add-section': addSection,
	'cnl-move-section': moveSection,
	'cnl-duplicate-section': duplicateSection,
	'cnl-remove-section': removeSection,
	'cnl-style-section': styleSection,
	'cnl-set-site-style': setSiteStyleTool,
	'cnl-set-site-title': setSiteTitle,
};

/**
 * Run one of the editor's WebMCP tools.
 *
 * @param {string} name  The tool's name.
 * @param {Object} input What the agent called it with.
 * @return {Promise<Object>} What to tell the agent.
 */
export async function runWebMcpTool( name, input ) {
	const run = RUN[ name ];

	if ( ! run ) {
		throw new Error( `There is no tool called ${ name }.` );
	}

	return run( input );
}
