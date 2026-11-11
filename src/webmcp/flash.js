/**
 * Showing the person what an agent changed: the blocks are scrolled into view
 * and flashed, held long enough to notice. They aren't picked, so nothing
 * like Edit design's bar opens over them while they watch. Some of the AI
 * plugin's tools select the block they change, as suits the post editor, so
 * that selection is let go too. Anything else the person has selected is
 * left alone. On a page, the section layer has picked the section by then,
 * as it does for any selection, so the badge sits at the block's right,
 * clear of the section's tab.
 *
 * Each block is marked as a change with the words for its badge, which the
 * canvas's styles (`cnl_editor_get_change_flash_css()`) turn into an orange
 * outline, tint and badge that fade away. Core's `flashBlock` isn't used, as
 * it keeps one block highlighted at a time, and a batch of changes shows all
 * of its blocks at once.
 *
 * WebMCP doesn't tell the page which agent called a tool, so the badge says
 * an agent made the change rather than naming it.
 *
 * The AI plugin's WebMCP tools ask for the same, for the blocks they change,
 * with `SHOW_CHANGE_EVENT` from `index.js`. See `includes/plugin-compat.php`.
 */

/**
 * WordPress dependencies
 */
import { store as blockEditorStore } from '@wordpress/block-editor';
import { dispatch, select } from '@wordpress/data';
import { __ } from '@wordpress/i18n';

const FLASH_MS = 3000;
const CHANGE_ATTRIBUTE = 'data-cnl-change';
// How long the fade in `cnl_editor_get_change_flash_css()` takes.
const DURATION_PROPERTY = '--cnl-change-duration';
// Room left above the changes when they are too tall to show whole.
const SCROLL_MARGIN = 48;

function getCanvasDocument() {
	return document.querySelector( 'iframe[name="editor-canvas"]' )
		?.contentDocument;
}

// A block just added, or swapped for another, draws on the next frame.
function nextFrame() {
	return new Promise( ( resolve ) =>
		window.requestAnimationFrame( () =>
			window.requestAnimationFrame( resolve )
		)
	);
}

/**
 * The blocks to show, once each: those still on the canvas, less any inside
 * another being shown, which its outline already covers.
 *
 * @param {string[]} clientIds The blocks.
 * @return {string[]} The blocks to show.
 */
function getBlocksToShow( clientIds ) {
	const { getBlock, getBlockParents } = select( blockEditorStore );
	const blocks = new Set(
		clientIds.filter( ( clientId ) => clientId && getBlock( clientId ) )
	);

	return [ ...blocks ].filter(
		( clientId ) =>
			! getBlockParents( clientId ).some( ( parent ) =>
				blocks.has( parent )
			)
	);
}

/**
 * Scroll the canvas to the changed blocks: centred on them all if they fit,
 * or to the top of the first if not.
 *
 * @param {Document}  canvas   The canvas's document.
 * @param {Element[]} elements The blocks.
 */
function scrollTo( canvas, elements ) {
	const view = canvas.defaultView;
	const rects = elements.map( ( element ) =>
		element.getBoundingClientRect()
	);
	const top = Math.min( ...rects.map( ( rect ) => rect.top ) );
	const bottom = Math.max( ...rects.map( ( rect ) => rect.bottom ) );
	const offset =
		bottom - top < view.innerHeight
			? ( top + bottom - view.innerHeight ) / 2
			: top - SCROLL_MARGIN;

	view.scrollBy( { top: offset, behavior: 'smooth' } );
}

const timers = new Map();

function mark( element, clientId, duration ) {
	// Marked again before the last flash ended: start its fade over.
	element.removeAttribute( CHANGE_ATTRIBUTE );
	void element.offsetWidth;
	element.setAttribute( CHANGE_ATTRIBUTE, __( 'Updated by agent' ) );
	element.style.setProperty( DURATION_PROPERTY, `${ duration }ms` );

	window.clearTimeout( timers.get( clientId ) );
	timers.set(
		clientId,
		window.setTimeout( () => {
			element.removeAttribute( CHANGE_ATTRIBUTE );
			element.style.removeProperty( DURATION_PROPERTY );
			timers.delete( clientId );
		}, duration )
	);
}

/**
 * Scroll changed blocks into view and flash them all at once.
 *
 * @param {string[]} clientIds The blocks, as often as they changed.
 * @param {number}   duration  How long to flash them, in milliseconds.
 * @return {Promise} Resolves once the flash has started.
 */
export async function showChanges( clientIds, duration = FLASH_MS ) {
	const blocks = getBlocksToShow( clientIds );

	if ( ! blocks.length ) {
		return;
	}

	const selected = select( blockEditorStore ).getSelectedBlockClientId();

	if ( selected && blocks.includes( selected ) ) {
		dispatch( blockEditorStore ).clearSelectedBlock();
	}

	await nextFrame();

	const canvas = getCanvasDocument();
	const shown = blocks
		.map( ( clientId ) => [
			clientId,
			canvas?.getElementById( `block-${ clientId }` ),
		] )
		.filter( ( [ , element ] ) => element );

	if ( ! shown.length ) {
		return;
	}

	scrollTo(
		canvas,
		shown.map( ( [ , element ] ) => element )
	);
	shown.forEach( ( [ clientId, element ] ) =>
		mark( element, clientId, duration )
	);
}

/**
 * Scroll a changed block into view and flash it.
 *
 * @param {?string} clientId The block.
 * @return {Promise} Resolves once the flash has started.
 */
export function showChange( clientId ) {
	return showChanges( [ clientId ] );
}
