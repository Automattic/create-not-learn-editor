/**
 * How many layouts a row of the layouts' grid holds. Pure, so it can be
 * tested without the editor.
 */

// A layout card and the gap after it, and the tray's padding around them.
const LAYOUT_CARD_WIDTH = 184;
const TRAY_CHROME_WIDTH = 40;
// The most layouts a row of the grid holds.
export const MAX_LAYOUT_COLUMNS = 4;

/**
 * The most layouts a row of Edit design's grid holds on a canvas this wide:
 * as many cards as fit, up to the most it takes.
 *
 * @param {number} canvasWidth The canvas's width.
 * @return {number} Layouts a row.
 */
export function getLayoutColumns( canvasWidth ) {
	return Math.max(
		1,
		Math.min(
			MAX_LAYOUT_COLUMNS,
			Math.floor(
				( canvasWidth - TRAY_CHROME_WIDTH ) / LAYOUT_CARD_WIDTH
			)
		)
	);
}

/**
 * How many layouts a row holds: up to three, or four when three would leave
 * one on its own, and two by two for four. Never more than there is room for.
 *
 * @param {number} count      How many layouts there are.
 * @param {number} maxColumns The most a row has room for.
 * @return {number} Layouts a row.
 */
export function getLayoutGridColumns( count, maxColumns ) {
	let columns = count === 4 ? 2 : Math.min( count, 3 );

	if ( count > 4 && count % 3 === 1 && count % 4 !== 1 ) {
		columns = 4;
	}

	return Math.max( 1, Math.min( columns, maxColumns ) );
}
