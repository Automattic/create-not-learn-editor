/**
 * What the person using the editor can do, as the server says
 * (`includes/capabilities.php`), for hiding what they can't.
 *
 * Imported package by package, so app init can use it without loading the
 * editor.
 */

/**
 * Internal dependencies
 */
import { settings } from './settings';

/**
 * Whether the person can use an area of the editor.
 *
 * @param {string} area An area of `cnl_editor_get_capability_map()`: `site`,
 *                      `identity`, `homepage`, `media` or `shop`.
 * @return {boolean} Whether they can. Without word from the server, they can.
 */
export function userCan( area ) {
	return settings.can?.[ area ] ?? true;
}

function matchesPath( pattern, path ) {
	const patternParts = pattern.split( '/' );
	const pathParts = path.split( '/' );

	return (
		patternParts.length === pathParts.length &&
		patternParts.every(
			( part, index ) =>
				part.startsWith( '$' ) ||
				part === decodeURIComponent( pathParts[ index ] )
		)
	);
}

/**
 * Whether the person can open a screen: its route is registered for them,
 * and, for content, they can write that kind of content.
 *
 * @param {string} to The screen's path, without its query.
 * @return {boolean} Whether they can. Without word from the server, they can.
 */
export function canOpen( to ) {
	if ( typeof to !== 'string' ) {
		return true;
	}

	const path = to.split( '?' )[ 0 ].replace( /(.)\/$/, '$1' );
	const type = path.match( /^\/types\/([^/]+)/ )?.[ 1 ];

	if ( type ) {
		const postType = [
			...( settings.postTypes || [] ),
			...( settings.editablePostTypes || [] ),
		].find( ( { name } ) => name === type );

		if ( postType && ! postType.canEdit ) {
			return false;
		}
	}

	if ( ! Array.isArray( settings.routes ) ) {
		return true;
	}

	return settings.routes.some( ( pattern ) => matchesPath( pattern, path ) );
}
