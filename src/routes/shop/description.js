/**
 * A product's short description, as WooCommerce stores it, HTML, and as the
 * Products screen shows it, plain text with paragraphs a blank line apart.
 */

/**
 * WordPress dependencies
 */
import { escapeHTML } from '@wordpress/escape-html';
import { decodeEntities } from '@wordpress/html-entities';

/**
 * A description the Products screen can change: plain paragraphs, nothing
 * else.
 *
 * @param {string} html Description as WooCommerce stores it.
 * @return {?string} The text, paragraphs a blank line apart, or null when
 *                   the description has other formatting.
 */
export function getPlainDescription( html = '' ) {
	const withoutParagraphs = html
		.replace( /<\/p>\s*<p>/g, '\n\n' )
		.replace( /<\/?p>/g, '' )
		.replace( /<br\s*\/?>/g, '\n' );

	if ( /<[a-z!/]/i.test( withoutParagraphs ) ) {
		return null;
	}

	return decodeEntities( withoutParagraphs ).trim();
}

/**
 * @param {string} text Description as typed.
 * @return {string} The description as WooCommerce stores it.
 */
export function toDescriptionHtml( text ) {
	return text
		.split( /\n{2,}/ )
		.map( ( paragraph ) => paragraph.trim() )
		.filter( Boolean )
		.map(
			( paragraph ) =>
				`<p>${ escapeHTML( paragraph ).replace( /\n/g, '<br>' ) }</p>`
		)
		.join( '' );
}

/**
 * Whether text being typed is what a stored description says. The stored
 * description drops the space or blank line typed last, which is still the
 * same description, so a field shouldn't take it back from what was typed.
 *
 * @param {string} text Description as typed.
 * @param {string} html Description as stored.
 * @return {boolean} Whether they say the same.
 */
export function isDescriptionOf( text, html = '' ) {
	return toDescriptionHtml( text ) === html;
}

/**
 * @param {string} html Description with formatting.
 * @return {string} Its words, without it.
 */
export function stripTags( html = '' ) {
	return decodeEntities( html.replace( /<[^>]+>/g, ' ' ) )
		.replace( /\s+/g, ' ' )
		.trim();
}
