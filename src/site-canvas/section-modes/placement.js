/**
 * Pure placement helpers for the section layer: where its tabs, bars and
 * trays sit against a section on the canvas, and which blocks lie where.
 */

/**
 * Internal dependencies
 */
import { blockEditorStore } from '../../wordpress-packages';
import { MAX_PER_SLIDE } from './design-bar';

// Sizes on screen, in pixels.
export const INSET = 12;
// Room either side of the "Add section" button, at the middle of the top
// edge, that the section's name in its tab keeps clear of.
const ADD_SECTION_CLEARANCE = 90;
export const TAB_HEIGHT = 24;
// Between a section and what is placed against it, outside.
const PLACE_GAP = 8;
// A layout card and the gap after it, and the tray's room around its cards
// for its padding and the carousel's arrows.
const LAYOUT_CARD_WIDTH = 144;
const TRAY_CHROME_WIDTH = 132;

/**
 * Position a box relative to the canvas it is clipped to.
 *
 * @param {Object} rect  `{ top, left, width, height }` on the layer.
 * @param {Object} frame The canvas's own rect on the layer.
 * @return {Object} `{ top, left, width, height }` on the canvas.
 */
export function local( rect, frame ) {
	return {
		height: rect.height,
		left: rect.left - frame.left,
		top: rect.top - frame.top,
		width: rect.width,
	};
}

/**
 * Where a section's name goes, in a tab against its outline: over its top
 * edge, or inside it while there is no room above it on the canvas. The
 * section at the very top of the page, usually the header, has nothing above
 * it to sit on, so its tab hangs under its bottom edge instead, clear of what
 * is in it.
 *
 * @param {Object}  box          The section, on the canvas.
 * @param {boolean} isPageTop    Whether it is at the very top of the page.
 * @param {number}  canvasHeight The canvas's height.
 * @return {Object} `{ isBelow, isInside, style }` for `SectionTab`.
 */
export function placeTab( box, isPageTop, canvasHeight ) {
	const bottom = box.top + box.height;
	const isBelow = isPageTop && bottom + TAB_HEIGHT <= canvasHeight;
	const isInside = ! isBelow && box.top < TAB_HEIGHT;
	let top = box.top - TAB_HEIGHT;

	if ( isBelow ) {
		top = bottom;
	} else if ( isInside ) {
		top = box.top;
	}

	return {
		isBelow,
		isInside,
		style: {
			left: box.left,
			maxWidth: box.width / 2 - ADD_SECTION_CLEARANCE,
			top,
		},
	};
}

/**
 * Whether a block starts or ends the page: first, or last, among its
 * siblings, and its parents among theirs, all the way up.
 *
 * @param {Function} select   The data registry's `select`.
 * @param {string}   clientId The block.
 * @param {boolean}  isEnd    Whether to check for the end of the page.
 * @return {boolean} Whether it does.
 */
export function isAtPageEdge( select, clientId, isEnd ) {
	const { getBlockOrder, getBlockRootClientId } = select( blockEditorStore );
	let id = clientId;

	while ( id ) {
		const parentId = getBlockRootClientId( id );
		const siblings = getBlockOrder( parentId || '' );

		if ( siblings[ isEnd ? siblings.length - 1 : 0 ] !== id ) {
			return false;
		}

		id = parentId;
	}

	return true;
}

/**
 * Where something stuck to the top of a section sits: at its top, or at the
 * top of the canvas while the section's top is scrolled out of view, but
 * never past its bottom.
 *
 * @param {Object} box    The section, on the canvas.
 * @param {number} height The height of what is stuck.
 * @param {number} inset  Its gap from the edges.
 * @return {number} Its top, on the canvas.
 */
export function stickyTop( box, height, inset = INSET ) {
	return Math.max(
		box.top + inset,
		Math.min(
			Math.max( box.top, 0 ) + inset,
			box.top + box.height - height - inset
		)
	);
}

/**
 * Where a bar inside a section goes: at its top while that is in view, else
 * at its bottom, kept in view while the section runs past the canvas's
 * bottom, but never past its top.
 *
 * @param {Object} box          The section, on the canvas.
 * @param {number} height       The bar's height.
 * @param {number} canvasHeight The canvas's height.
 * @return {number} Its top, on the canvas.
 */
export function placeAtEdge( box, height, canvasHeight ) {
	const top = box.top + INSET;

	if ( top >= 0 && top + height <= canvasHeight - INSET ) {
		return top;
	}

	return Math.max(
		top,
		Math.min( box.top + box.height, canvasHeight ) - height - INSET
	);
}

/**
 * Where something placed against a section goes, outside it so the section
 * stays in view: under its bottom edge if it fits on the canvas there, else
 * over its top edge if it fits there, else wherever on the canvas it is
 * nearest to under the section, overlapping it rather than leaving view.
 *
 * @param {Object}  box          The section, on the canvas.
 * @param {number}  height       What is placed's height.
 * @param {number}  canvasHeight The canvas's height.
 * @param {boolean} isBelow      Whether it always goes under, as for the
 *                               header, at the canvas's top.
 * @return {number} Its top, on the canvas.
 */
export function placeOutside( box, height, canvasHeight, isBelow = false ) {
	const below = box.top + box.height + PLACE_GAP;
	const above = box.top - height - PLACE_GAP;

	if ( isBelow || below + height <= canvasHeight - INSET ) {
		return below;
	}

	if ( above >= INSET ) {
		return above;
	}

	return Math.max( INSET, Math.min( below, canvasHeight - height - INSET ) );
}

/**
 * How many layouts a slide of Edit design's carousel holds on a canvas this
 * wide: as many cards as fit beside its arrows, up to the most it takes.
 *
 * @param {number} canvasWidth The canvas's width.
 * @return {number} Layouts a slide.
 */
export function getLayoutsPerSlide( canvasWidth ) {
	return Math.max(
		1,
		Math.min(
			MAX_PER_SLIDE,
			Math.floor(
				( canvasWidth - TRAY_CHROME_WIDTH ) / LAYOUT_CARD_WIDTH
			)
		)
	);
}

/**
 * The innermost block at a point on the canvas. Zoomed out, core stops the
 * pointer inside each section, so the section is what the point hits, and
 * the block within it is found by where its blocks are drawn: in document
 * order a block comes after those around it, so the last to hold the point
 * is the innermost.
 *
 * @param {Document} doc The canvas.
 * @param {number}   x   Across the canvas, in pixels.
 * @param {number}   y   Down the canvas, in pixels.
 * @return {?string} The block's client ID.
 */
export function getBlockAtPoint( doc, x, y ) {
	const hit = doc.elementFromPoint( x, y )?.closest( '[data-block]' );

	if ( ! hit ) {
		return null;
	}

	let block = hit;

	hit.querySelectorAll( '[data-block]' ).forEach( ( node ) => {
		const rect = node.getBoundingClientRect();

		if (
			x >= rect.left &&
			x <= rect.right &&
			y >= rect.top &&
			y <= rect.bottom
		) {
			block = node;
		}
	} );

	return block.dataset.block;
}

/**
 * The blocks beside a section, and beside each block around it: the rest of
 * the page, without what holds the section.
 *
 * @param {Function} select   The data registry's `select`.
 * @param {string}   clientId The section.
 * @return {string[]} Their client IDs.
 */
export function getBlocksBeside( select, clientId ) {
	const { getBlockOrder, getBlockParents, getBlockRootClientId } =
		select( blockEditorStore );

	return [ ...getBlockParents( clientId ), clientId ].flatMap( ( id ) =>
		getBlockOrder( getBlockRootClientId( id ) || '' ).filter(
			( other ) => other !== id
		)
	);
}
