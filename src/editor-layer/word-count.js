/**
 * Counting a post's words, kept free of packages so it can be tested on its
 * own.
 */

/**
 * How many words some post content has.
 *
 * @param {string} content Serialised post content.
 * @return {number} The word count.
 */
export function countWords( content ) {
	const text = String( content || '' )
		.replace( /<!--[\s\S]*?-->/g, ' ' )
		.replace( /<[^>]+>/g, ' ' )
		.replace( /&[a-z0-9#]+;/gi, ' ' );

	return text.match( /[^\s—–-]+/g )?.length || 0;
}
