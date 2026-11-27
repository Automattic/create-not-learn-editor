/**
 * How many layouts a row of the layouts' grid holds. Pure, so it can be
 * tested without the editor.
 */

// The most layouts a row of the grid holds.
export const MAX_LAYOUT_COLUMNS = 4;

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
