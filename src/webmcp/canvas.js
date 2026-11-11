/**
 * The page open in the site canvas, read as the canvas shows it: a list of
 * sections, each known by its number from the top.
 *
 * The sections are the blocks under core's section root, the page's Post
 * Content when it shows in its template. On a page, each run of plain blocks
 * between them is one Text section, as `src/site-canvas/writing-mode.js` has
 * it for the canvas.
 */

/**
 * WordPress dependencies
 */
import { store as blockEditorStore } from '@wordpress/block-editor';
import { select, subscribe } from '@wordpress/data';
import { store as editorStore } from '@wordpress/editor';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { unlock } from '../lock-unlock';
import { getColorChoices, getColorOffer } from '../pickers/section-design';
import { getSectionWidth } from '../pickers/section-width';
import { getSectionArrangements } from '../layouts/variants';
import {
	getSectionKind,
	getSectionSummary,
	getSectionTitle,
} from '../routes/content/pages/page-sections';
import { MODE_EDIT, setCanvasMode } from '../site-canvas/mode';
import { getWritingSections, groupsTextIn } from '../site-canvas/writing-mode';

export const NO_PAGE_OPEN =
	"No page is open in the editor's canvas. Open one with cnl-open-page first.";

const WAIT_MS = 15000;

/**
 * The page open in the canvas, if any.
 *
 * @return {?Object} `{ postId, postType, rootClientId }`, or null.
 */
export function getCanvas() {
	const editor = select( editorStore );
	const postId = editor.getCurrentPostId();
	const rootClientId = unlock(
		select( blockEditorStore )
	).getSectionRootClientId?.();

	if ( ! postId || ! rootClientId ) {
		return null;
	}

	return { postId, postType: editor.getCurrentPostType(), rootClientId };
}

/**
 * The page open in the canvas, ready to change, or an error saying none is.
 *
 * @return {Object} As `getCanvas`.
 */
export function requireCanvas() {
	const canvas = getCanvas();

	if ( ! canvas ) {
		throw new Error( NO_PAGE_OPEN );
	}

	setCanvasMode( MODE_EDIT );

	return canvas;
}

/**
 * The page's sections, in order.
 *
 * @param {Object} canvas              From `getCanvas`.
 * @param {string} canvas.postType     The page's type.
 * @param {string} canvas.rootClientId The section root.
 * @return {Object[]} `{ clientIds, isText }` for each. A section is known by
 *                    its first block.
 */
export function getSections( { postType, rootClientId } ) {
	const blockEditor = select( blockEditorStore );
	const order = blockEditor.getBlockOrder( rootClientId );

	if ( ! groupsTextIn( postType ) ) {
		return order.map( ( clientId ) => ( {
			clientIds: [ clientId ],
			isText: false,
		} ) );
	}

	return getWritingSections( order, blockEditor.getBlockName );
}

/**
 * A section by its number, or an error saying there is none.
 *
 * @param {Object[]} sections From `getSections`.
 * @param {number}   number   Its number, from 1.
 * @return {Object} The section.
 */
export function getSection( sections, number ) {
	const section = sections[ Number( number ) - 1 ];

	if ( ! section ) {
		throw new Error(
			`There is no section ${ number }. The page has ${ sections.length }, numbered from 1.`
		);
	}

	return section;
}

/**
 * A section's block, with its blocks, as the pickers read it.
 *
 * @param {string} clientId The section's block.
 * @return {Object} The block.
 */
export function getSectionBlock( clientId ) {
	const blockEditor = select( blockEditorStore );

	return {
		...blockEditor.getBlock( clientId ),
		innerBlocks: blockEditor.getBlocks( clientId ),
	};
}

/**
 * A section's name, as the canvas shows it in the section's tab.
 *
 * @param {Object} section From `getSections`.
 * @return {string} Its name.
 */
export function getSectionName( section ) {
	return section.isText
		? __( 'Text' )
		: getSectionTitle( getSectionBlock( section.clientIds[ 0 ] ) );
}

/**
 * A section's colours, as Edit design offers them, or null.
 *
 * @param {Object} block From `getSectionBlock`.
 * @return {?Object} `{ choices, offer }`.
 */
export function getColorChoicesFor( block ) {
	const choices = getColorChoices( select, block.name );
	const offer = getColorOffer( [ block ], choices );

	return offer && { choices, offer };
}

function getLabel( options, name ) {
	return options.find( ( option ) => option.name === name )?.label ?? null;
}

function describeChoices( block ) {
	const colors = getColorChoicesFor( block );
	const layouts = getSectionArrangements( block );
	const width = getSectionWidth( block );

	return {
		color: colors && {
			current: getLabel( colors.offer.options, colors.offer.current ),
			options: colors.offer.options.map( ( option ) => option.label ),
		},
		layout: layouts && {
			current: getLabel( layouts.options, layouts.current ),
			options: layouts.options.map( ( option ) => option.label ),
		},
		width: width && { current: width.current, options: width.options },
	};
}

function describeSection( section, index ) {
	const blockEditor = select( blockEditorStore );
	const [ clientId ] = section.clientIds;

	if ( section.isText ) {
		return {
			number: index + 1,
			name: 'Text',
			text: section.clientIds
				.map( ( id ) => getSectionTitle( blockEditor.getBlock( id ) ) )
				.join( ' ' )
				.slice( 0, 160 ),
		};
	}

	const block = getSectionBlock( clientId );
	const title = getSectionTitle( block );
	const summary = getSectionSummary( block );

	return {
		number: index + 1,
		name: title,
		kind: getSectionKind( block ),
		...( summary && summary !== title ? { contents: summary } : {} ),
		...describeChoices( block ),
	};
}

/**
 * The page open in the canvas, described for an agent.
 *
 * @return {Object} `{ page, sections }`.
 */
export function describePage() {
	const canvas = getCanvas();

	if ( ! canvas ) {
		throw new Error( NO_PAGE_OPEN );
	}

	const editor = select( editorStore );

	return {
		page: {
			id: canvas.postId,
			type: canvas.postType,
			title: editor.getEditedPostAttribute( 'title' ),
			status: editor.getEditedPostAttribute( 'status' ),
		},
		sections: getSections( canvas ).map( describeSection ),
	};
}

/**
 * Wait for something in the editor's stores.
 *
 * @param {Function} check   Returns what was waited for, or nothing yet.
 * @param {string}   timeout What to say if it doesn't come.
 * @param {number}   ms      How long to wait.
 * @return {Promise<*>} What `check` returned.
 */
export function waitFor( check, timeout, ms = WAIT_MS ) {
	return new Promise( ( resolve, reject ) => {
		const now = check();

		if ( now ) {
			resolve( now );
			return;
		}

		let unsubscribe = () => {};
		const timer = setTimeout( () => {
			unsubscribe();
			reject( new Error( timeout ) );
		}, ms );

		unsubscribe = subscribe( () => {
			const result = check();

			if ( result ) {
				clearTimeout( timer );
				unsubscribe();
				resolve( result );
			}
		} );
	} );
}

/**
 * Whether a page's sections are ready to read: patterns it was made from
 * have been swapped for their blocks.
 *
 * @param {Object} canvas From `getCanvas`.
 * @return {boolean} Whether they are.
 */
export function areSectionsReady( canvas ) {
	const blockEditor = select( blockEditorStore );

	return blockEditor
		.getBlockOrder( canvas.rootClientId )
		.every( ( id ) => blockEditor.getBlockName( id ) !== 'core/pattern' );
}
