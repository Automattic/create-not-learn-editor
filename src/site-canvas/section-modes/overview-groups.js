/**
 * The groups Document Overview's list shows, kept apart from the list so
 * it can be tested without the editor.
 */

/**
 * Sort the rows into the groups the list shows: the header parts at the top
 * of the page, the footer parts at its bottom, and everything between.
 *
 * @param {Array} rows Rows in page order, each `{ area }` for a part.
 * @return {Object} `{ header, content, footer }`, each an array of rows.
 */
export function groupOverviewRows( rows ) {
	let start = 0;
	let end = rows.length;

	while ( start < end && rows[ start ].area === 'header' ) {
		start++;
	}

	while ( end > start && rows[ end - 1 ].area === 'footer' ) {
		end--;
	}

	return {
		header: rows.slice( 0, start ),
		content: rows.slice( start, end ),
		footer: rows.slice( end ),
	};
}
